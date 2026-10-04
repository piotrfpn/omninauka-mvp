import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Object keys stay opaque: validate the namespace without decoding/rewriting.
function isValidStudyMaterialPath(path: unknown, userId: string): path is string {
  if (typeof path !== 'string' || path === '' || path !== path.trim() || path.includes('\\')) return false;
  const segments = path.split('/');
  return segments.length >= 2 && (segments[0] === userId || segments[0] === 'uploads')
    && segments.every(segment => segment !== '' && segment !== '.' && segment !== '..');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1. Auth check
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
    });

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Get user from JWT
    const jwtToken = authHeader.replace('Bearer ', '').replace('bearer ', '');
    const { data: { user }, error: authError } = await adminClient.auth.getUser(jwtToken);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
      });
    }

    const userId = user.id;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    console.log(`Starting account deletion for user: ${userId}`);

    // 2. Collect files to delete from Storage
    // We need to find all image_urls associated with this user
    
    // a) From study_sessions
    const { data: sessions } = await adminClient
      .from('study_sessions')
      .select('id, image_url')
      .eq('user_id', userId);
    
    // b) From session_images
    const sessionIds = sessions?.map(s => s.id) || [];
    const { data: sessionImages } = await adminClient
      .from('session_images')
      .select('image_url')
      .in('session_id', sessionIds);

    const filesToDelete = new Set<string>();
    const addStoragePath = (path: unknown) => {
      if (path === null || path === undefined) return;
      if (!isValidStudyMaterialPath(path, userId)) {
        console.warn('[delete-account] Unsafe material path skipped');
        return;
      }
      filesToDelete.add(path);
    };
    if (sessions) {
      sessions.forEach(s => addStoragePath(s.image_url));
    }
    if (sessionImages) {
      sessionImages.forEach(si => addStoragePath(si.image_url));
    }

    // 3. Delete files from Storage
    if (filesToDelete.size > 0) {
      const paths = Array.from(filesToDelete);
      console.log(`Deleting ${paths.length} files from storage...`);
      const { error: storageError } = await userClient.storage
        .from('study-materials')
        .remove(paths);
      
      if (storageError) {
        console.error("Storage deletion error (non-blocking)");
      }
    }

    // 4. Delete DB records in order
    console.log("Deleting database records...");
    
    // We'll use a sequence of deletions. 
    // Foreign keys usually handle some cascade, but we'll be explicit where needed.
    
    // tutor_messages -> tutor_threads
    await adminClient.from('tutor_messages').delete().eq('user_id', userId);
    await adminClient.from('tutor_threads').delete().eq('user_id', userId);
    
    // session_images -> study_sessions
    if (sessionIds.length > 0) {
      await adminClient.from('session_images').delete().in('session_id', sessionIds);
    }
    await adminClient.from('study_sessions').delete().eq('user_id', userId);
    
    // folders
    await adminClient.from('folders').delete().eq('user_id', userId);
    
    // parental_consents
    await adminClient.from('parental_consents').delete().eq('child_user_id', userId);
    
    // profiles
    await adminClient.from('profiles').delete().eq('id', userId);

    // 5. Delete Auth User
    console.log("Deleting Auth user...");
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserError) throw deleteUserError;

    console.log(`Account deletion completed for user: ${userId}`);

    return new Response(JSON.stringify({ success: true, message: "Konto zostało pomyślnie usunięte." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    console.error("Account deletion error:", err.message);
    return new Response(JSON.stringify({ error: err.message || "Błąd podczas usuwania konta." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
