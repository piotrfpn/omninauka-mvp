import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1. Auth check
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) throw new Error("Missing Authorization header");

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Get user from JWT
    const jwtToken = authHeader.replace('Bearer ', '').replace('bearer ', '');
    const { data: { user }, error: authError } = await adminClient.auth.getUser(jwtToken);
    
    if (authError || !user) {
      throw new Error("Unauthorized or invalid session");
    }

    const userId = user.id;
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
    if (sessions) {
      sessions.forEach(s => { if (s.image_url) filesToDelete.add(s.image_url); });
    }
    if (sessionImages) {
      sessionImages.forEach(si => { if (si.image_url) filesToDelete.add(si.image_url); });
    }

    // 3. Delete files from Storage
    if (filesToDelete.size > 0) {
      const paths = Array.from(filesToDelete);
      console.log(`Deleting ${paths.length} files from storage...`);
      const { error: storageError } = await adminClient.storage
        .from('study-materials')
        .remove(paths);
      
      if (storageError) {
        console.error("Storage deletion error (non-blocking):", storageError);
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
