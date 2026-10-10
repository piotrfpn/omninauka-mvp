import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isValidStudyMaterialPath(path: unknown, userId: string): path is string {
  if (typeof path !== 'string' || path === '' || path !== path.trim() || path.includes('\\')) return false;
  const segments = path.split('/');
  return segments.length >= 2 && (segments[0] === userId || segments[0] === 'uploads')
    && segments.every(segment => segment !== '' && segment !== '.' && segment !== '..');
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid authorization format' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const token = parts[1].trim();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const JWKS = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));

    let userId: string;
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `${supabaseUrl}/auth/v1`,
      });
      if (!payload.sub) throw new Error("Missing sub claim");
      userId = payload.sub;
    } catch (err: any) {
      return new Response(JSON.stringify({ error: 'Unauthorized: token validation failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = body.sessionId;

    if (!sessionId || typeof sessionId !== 'string' || !uuidRegex.test(sessionId)) {
      return new Response(JSON.stringify({ error: 'Invalid sessionId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 1. Fetch session and verify ownership (allow soft-deleted for retry)
    const { data: sessionData, error: fetchError } = await adminClient
      .from('study_sessions')
      .select('id, user_id, deleted_at')
      .eq('id', sessionId)
      .maybeSingle();

    if (fetchError) {
      return new Response(JSON.stringify({ error: 'Database lookup error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!sessionData) {
      // Root already absent
      return new Response(JSON.stringify({ success: true, deleted: true, alreadyDeleted: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (sessionData.user_id !== userId) {
      // Foreign session
      return new Response(JSON.stringify({ error: 'Session not found or forbidden' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // 2. BEGIN PURGE (via RPC)
    const { error: purgeError } = await adminClient
      .rpc('begin_session_purge', { p_session_id: sessionId, p_user_id: userId });

    if (purgeError) {
      return new Response(JSON.stringify({ error: 'Failed to begin purge' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // 3. STORAGE INVENTORY
    const inventory = new Set<string>();

    const { data: rootData, error: rootInventoryError } = await adminClient.from('study_sessions').select('image_url').eq('id', sessionId).single();
    if (rootInventoryError || !rootData) {
      return new Response(JSON.stringify({ error: 'Inventory error' }), { headers: corsHeaders, status: 500 });
    }
    if (rootData?.image_url) inventory.add(rootData.image_url);

    let hasMoreImages = true;
    let fromImages = 0;
    while (hasMoreImages) {
      const { data: imageRows, error } = await adminClient
        .from('session_images')
        .select('image_url')
        .eq('session_id', sessionId)
        .range(fromImages, fromImages + 999);
      if (error) {
        return new Response(JSON.stringify({ error: 'Inventory error' }), { headers: corsHeaders, status: 500 });
      }
      if (imageRows && imageRows.length > 0) {
        for (const row of imageRows) {
          if (row.image_url) inventory.add(row.image_url);
        }
        fromImages += 1000;
      } else {
        hasMoreImages = false;
      }
    }

    const prefix = `${userId}/${sessionId}`;
    let fetchingFolder = true;
    let offsetFolder = 0;
    const limitFolder = 100;
    while (fetchingFolder) {
      const { data: files, error: listError } = await adminClient.storage
        .from('study-materials')
        .list(prefix, { limit: limitFolder, offset: offsetFolder });
      if (listError) {
        return new Response(JSON.stringify({ error: 'Storage inventory error' }), { headers: corsHeaders, status: 500 });
      }
      if (files && files.length > 0) {
        for (const f of files) {
          if (f.name && f.name !== '.emptyFolderPlaceholder') {
             inventory.add(`${prefix}/${f.name}`);
          }
        }
        offsetFolder += limitFolder;
      } else {
        fetchingFolder = false;
      }
    }

    const allPaths = Array.from(inventory);

    // 4. FAIL-CLOSED VALIDATION
    if (allPaths.length > 0) {
      // Service-role Storage bypasses RLS, so every candidate path must be a safe
      // path in the caller's own namespace (or legacy uploads/) before anything is removed.
      if (allPaths.some(p => !isValidStudyMaterialPath(p, userId))) {
        return new Response(JSON.stringify({ error: 'Unsafe material path' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409,
        });
      }

      const { data: sharedRoots, error: checkRootsError } = await adminClient
        .from('study_sessions')
        .select('id')
        .in('image_url', allPaths)
        .neq('id', sessionId)
        .limit(1);

      if (checkRootsError) {
        return new Response(JSON.stringify({ error: 'Validation error' }), { headers: corsHeaders, status: 500 });
      }

      const { data: sharedImages, error: checkImagesError } = await adminClient
        .from('session_images')
        .select('session_id')
        .in('image_url', allPaths)
        .neq('session_id', sessionId)
        .limit(1);

      if (checkImagesError) {
        return new Response(JSON.stringify({ error: 'Validation error' }), { headers: corsHeaders, status: 500 });
      }

      if ((sharedRoots && sharedRoots.length > 0) || (sharedImages && sharedImages.length > 0)) {
        return new Response(JSON.stringify({ error: 'Shared object conflict' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409, // 409 Conflict => DO NOT DELETE OBJECT, target root remains soft-deleted
        });
      }

      // 5. LEGACY OWNERSHIP VERIFICATION
      for (const p of allPaths) {
        if (!p.startsWith(`${prefix}/`)) {
          const { data: ownerData, error: ownerError } = await adminClient.rpc('get_storage_object_owner', {
            p_bucket_id: 'study-materials',
            p_name: p
          });
          if (ownerError) {
             return new Response(JSON.stringify({ error: 'Legacy ownership verification error' }), { headers: corsHeaders, status: 500 });
          }
          if (ownerData && ownerData.length > 0) {
            const ownerId = ownerData[0].owner_id;
            if (!ownerId) {
              return new Response(JSON.stringify({ error: 'Legacy object owner NULL' }), { headers: corsHeaders, status: 409 });
            }
            if (ownerId !== userId) {
              return new Response(JSON.stringify({ error: 'Legacy object owner mismatch' }), { headers: corsHeaders, status: 409 });
            }
          }
        }
      }
    }

    // 6. STORAGE DELETE
    if (allPaths.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < allPaths.length; i += BATCH_SIZE) {
        const batch = allPaths.slice(i, i + BATCH_SIZE);
        const { error: storageError } = await adminClient.storage
          .from('study-materials')
          .remove(batch);

        if (storageError) {
           return new Response(JSON.stringify({ error: 'Partial storage failure' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500,
           });
        }
      }
    }

    // 7. STORAGE VERIFICATION
    const { data: verifyFolder, error: verifyFolderError } = await adminClient.storage
      .from('study-materials')
      .list(prefix, { limit: 1 });

    if (verifyFolderError) {
      return new Response(JSON.stringify({ error: 'Storage verification error' }), { headers: corsHeaders, status: 500 });
    }

    if (verifyFolder && verifyFolder.length > 0 && verifyFolder[0].name !== '.emptyFolderPlaceholder') {
       return new Response(JSON.stringify({ error: 'Storage verification failed: prefix not empty' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 500
       });
    }

    for (const p of allPaths) {
       if (!p.startsWith(`${prefix}/`)) {
          const pParts = p.split('/');
          const fileName = pParts.pop() || '';
          const pFolder = pParts.join('/');
          const { data: pList, error: legacyVerifyError } = await adminClient.storage.from('study-materials').list(pFolder, { search: fileName });
          if (legacyVerifyError) {
            return new Response(JSON.stringify({ error: 'Storage verification error' }), { headers: corsHeaders, status: 500 });
          }
          if (pList?.some(f => f.name === fileName)) {
            return new Response(JSON.stringify({ error: 'Storage verification failed for legacy path' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            });
          }
       }
    }

    // 8. HARD DELETE DATABASE ROOT
    const { error: hardDeleteError } = await adminClient
      .from('study_sessions')
      .delete({ count: 'exact' })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .not('deleted_at', 'is', null);

    if (hardDeleteError) {
      return new Response(JSON.stringify({ error: 'DB hard delete failure' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // 11. RESPONSE CONTRACT
    return new Response(JSON.stringify({ success: true, deleted: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
