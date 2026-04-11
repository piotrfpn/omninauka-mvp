import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("[delete-session] Invocation start");

    // 1. Auth — same jose/JWKS pattern as analyze-notes
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("[delete-session] 401: Missing Authorization header");
      return new Response(JSON.stringify({ error: 'Unauthorized: missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      console.error("[delete-session] 401: Invalid bearer format");
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
      console.log("[delete-session] Auth OK, userId:", userId);
    } catch (err: any) {
      console.error("[delete-session] 401: JWT verification failed ->", err?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: token validation failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // 2. Parse request body
    const body = await req.json();
    const sessionId = body.sessionId;

    if (!sessionId) {
      console.error("[delete-session] 400: Missing sessionId");
      return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 3. Admin client for storage + DB (bypasses RLS)
    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 4. Fetch session and verify ownership
    const { data: sessionData, error: fetchError } = await adminClient
      .from('study_sessions')
      .select('id, user_id, image_url, deleted_at')
      .eq('id', sessionId)
      .single();

    if (fetchError || !sessionData) {
      console.error("[delete-session] 404: Session not found ->", sessionId);
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    if (sessionData.user_id !== userId) {
      console.error("[delete-session] 403: Ownership mismatch");
      return new Response(JSON.stringify({ error: 'Forbidden: session belongs to another user' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // Already soft-deleted — idempotent, return success
    if (sessionData.deleted_at) {
      console.log("[delete-session] Session already deleted, idempotent success");
      return new Response(JSON.stringify({ success: true, alreadyDeleted: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 5. Delete image from Storage (best-effort, log but don't block on failure)
    if (sessionData.image_url) {
      const { error: storageError } = await adminClient.storage
        .from('study-materials')
        .remove([sessionData.image_url]);

      if (storageError) {
        console.error("[delete-session] Storage delete failed (non-blocking) ->", storageError.message);
      } else {
        console.log("[delete-session] Storage file deleted:", sessionData.image_url);
      }
    }

    // 6. Soft delete: set deleted_at on the DB row
    const { error: updateError } = await adminClient
      .from('study_sessions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (updateError) {
      console.error("[delete-session] DB update failed ->", updateError.message);
      return new Response(JSON.stringify({ error: `DB update failed: ${updateError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log("[delete-session] Session soft-deleted:", sessionId);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[delete-session] Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown server error" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
