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
    console.log("--- REGENERATE-MODULE INVOCATION START ---");

    // Step 1: Extract the Authorization header
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) {
      console.error("[regenerate-module] Missing Authorization header");
      return new Response(JSON.stringify({ error: 'Unauthorized: missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Step 2: Use auth.getUser() — delegates validation to Supabase Auth.
    // This is the recommended Supabase Edge Function pattern and is algorithm-agnostic.
    // It does NOT require knowing whether the project uses HS256, RS256, or ES256.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("[regenerate-module] 401: getUser() failed ->", authError?.message);
      return new Response(JSON.stringify({ error: `Unauthorized: ${authError?.message || 'invalid token'}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const userId = user.id;
    console.log(`[regenerate-module] Auth OK, userId: ${userId}`);

    // Step 3: Parse request body
    const body = await req.json();
    const { sessionId, module } = body;

    if (!sessionId || !module) {
      return new Response(JSON.stringify({ error: 'Missing sessionId or module' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (module !== 'flashcards' && module !== 'quiz') {
      return new Response(JSON.stringify({ error: 'Invalid module. Use flashcards or quiz.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Step 4: Load session data and user profile
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // --- Plan Verification (Sprint 23A) ---
    // We use get_my_effective_plan() to respect inherited family plans.
    let effectivePlan = 'free';
    try {
      const { data: effectiveData, error: planError } = await supabaseClient
        .rpc('get_my_effective_plan');

      if (planError) {
        console.warn('[regenerate-module] get_my_effective_plan failed, falling back to free plan', planError);
      } else if (effectiveData?.effective_plan) {
        effectivePlan = effectiveData.effective_plan;
      }
    } catch (err) {
      console.warn('[regenerate-module] get_my_effective_plan threw, falling back to free plan', err);
    }

    const { data: sessionData, error: dbError } = await adminClient
      .from('study_sessions')
      .select('raw_ocr_text, user_id')
      .eq('id', sessionId)
      .single();

    if (dbError || !sessionData) {
      console.error(`[regenerate-module] Session not found: ${sessionId}`, dbError?.message);
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Ownership check
    if (sessionData.user_id !== userId) {
      console.error(`[regenerate-module] 403: owner mismatch. session.user_id=${sessionData.user_id}, caller=${userId}`);
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    if (!sessionData.raw_ocr_text) {
      return new Response(JSON.stringify({ error: 'Session has no OCR text to regenerate from.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 422,
      });
    }

    // --- USAGE LIMITS GUARD ---
    if (module === 'flashcards') {
      const { count: regenCount, error: regenError } = await adminClient
        .from('usage_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .eq('event_type', 'flashcard_regen');

      if (regenError) {
        console.error("[regenerate-module] Regen count error:", regenError.message);
      }

      const regenLimit = effectivePlan === 'free' ? 1 : 5;

      if ((regenCount || 0) >= regenLimit) {
        console.warn(`[regenerate-module] 403: Regen limit reached for user ${userId}, session ${sessionId} (${regenCount}/${regenLimit})`);
        return new Response(JSON.stringify({ 
          error: "usage_limit_reached",
          feature: "flashcard_regen",
          limit: regenLimit,
          plan: effectivePlan === 'family' || effectivePlan === 'premium' ? 'premium' : 'free',
          message: effectivePlan === 'free' 
            ? "W planie Darmowym możesz wygenerować jedną dodatkową serię fiszek. Sprawdź Premium, aby odblokować więcej powtórek."
            : "Osiągnąłeś limit regeneracji fiszek dla tej lekcji (fair use)."
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }
    }
    // --------------------------

    console.log(`[regenerate-module] Regenerating module="${module}" for session=${sessionId}`);

    // Step 5: Build module-specific prompt
    let schema = '';
    let rules = '';
    const maxCards = effectivePlan === 'free' ? 5 : 20;

    if (module === 'flashcards') {
      schema = `{"flashcards": [{ "front": "String", "back": "String", "difficulty": "easy"|"medium"|"hard" }]}`;
      rules = `Wygeneruj maksymalnie ${maxCards} UNIKALNYCH fiszek. Każda dotyczy innego faktu. Zwróć TYLKO JSON flashcards.`;
    } else {
      schema = `{"quizQuestions": [{ "question": "String", "options": ["A","B","C","D"], "correctIndex": 0-3, "explanation": "String", "difficulty": "easy"|"medium"|"hard" }]}`;
      rules = `Wygeneruj 12 pytań (4 easy, 5 medium, 3 hard). DOKŁADNIE 4 opcje każde. Zwróć TYLKO JSON quizQuestions.`;
    }

    const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_KEY) throw new Error("OpenAI API Key missing");

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Jesteś ekspertem edukacyjnym. Generujesz materiały w języku polskim.\nSCHEMA: ${schema}\n${rules}`,
          },
          {
            role: "user",
            content: `Tekst OCR:\n${sessionData.raw_ocr_text}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!openAiResponse.ok) {
      const errText = await openAiResponse.text();
      throw new Error(`OpenAI error ${openAiResponse.status}: ${errText}`);
    }

    const aiPayload = await openAiResponse.json();
    const generation = JSON.parse(aiPayload.choices[0].message.content);

    // Deduplication helpers
    const normalise = (s: string) =>
      (s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
    const tokenSet = (s: string) =>
      new Set(normalise(s).split(' ').filter((w) => w.length >= 3));
    const jaccard = (a: string, b: string) => {
      const sa = tokenSet(a);
      const sb = tokenSet(b);
      if (sa.size === 0 && sb.size === 0) return 1;
      if (sa.size === 0 || sb.size === 0) return 0;
      let intersection = 0;
      for (const t of sa) { if (sb.has(t)) intersection++; }
      return intersection / (sa.size + sb.size - intersection);
    };

    let finalData: any[] = [];
    let finalUpdate: Record<string, any> = {};

    if (module === 'flashcards') {
      const raw: any[] = Array.isArray(generation.flashcards) ? generation.flashcards : [];
      const deduped = raw.filter((card, i) =>
        !raw.slice(0, i).some(
          (k) => jaccard(normalise(card.front ?? ''), normalise(k.front ?? '')) >= 0.75
        )
      );
      // Hard slice to enforce plan limits
      finalData = deduped.slice(0, maxCards);
      finalUpdate = { flashcards: finalData };
    } else {
      const raw: any[] = Array.isArray(generation.quizQuestions) ? generation.quizQuestions : [];
      finalData = raw.filter((q, i) =>
        !raw.slice(0, i).some(
          (k) => jaccard(normalise(q.question ?? ''), normalise(k.question ?? '')) >= 0.85
        )
      );
      finalUpdate = { quiz_questions: finalData };
    }

    console.log(`[regenerate-module] Generated ${finalData.length} items for module=${module}`);

    // Step 6: Write ONLY the targeted column — no other fields touched
    const { error: updateError } = await adminClient
      .from('study_sessions')
      .update(finalUpdate)
      .eq('id', sessionId);

    if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

    // Log usage event on success
    if (module === 'flashcards') {
      await adminClient.from('usage_events').insert({
        user_id: userId,
        event_type: 'flashcard_regen',
        session_id: sessionId,
        metadata: { effectivePlan, maxCards, count: finalData.length }
      });
    }

    return new Response(JSON.stringify({ success: true, module, data: finalData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[regenerate-module] Fatal error:', error?.message ?? error);
    return new Response(JSON.stringify({ error: error?.message || 'Server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
