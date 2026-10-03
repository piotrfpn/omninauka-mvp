import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getAiAccountDenial } from "../_shared/account-access.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function usageGuardUnavailable(): Response {
  return new Response(JSON.stringify({ error: 'usage_guard_unavailable' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 503,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let reservationId: string | null = null;
  let cleanupReservation: (() => Promise<void>) | null = null;
  const requestId = crypto.randomUUID();
  const requestStartedAt = performance.now();
  let requestStatus = 'error';
  const markTiming = (stage: string, extra: Record<string, unknown> = {}) => {
    console.info(JSON.stringify({ marker: 'regenerate-module-timing', requestId, stage,
      elapsedMs: Math.round(performance.now() - requestStartedAt), ...extra }));
  };
  markTiming('request_start');

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
      console.error("[regenerate-module] 401: getUser() failed");
      return new Response(JSON.stringify({ error: `Unauthorized: ${authError?.message || 'invalid token'}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const userId = user.id;

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

    const accountDenial = await getAiAccountDenial(
      adminClient.from('profiles').select('account_status').eq('id', userId).maybeSingle(),
      corsHeaders,
    );
    if (accountDenial) return accountDenial;

    // --- Plan Verification (Sprint 23A) ---
    // We use get_my_effective_plan() to respect inherited family plans.
    let effectivePlan = 'free';
    try {
      const { data: effectiveData, error: planError } = await supabaseClient
        .rpc('get_my_effective_plan');

      if (planError) {
        console.warn('[regenerate-module] get_my_effective_plan failed, falling back to free plan');
      } else if (effectiveData?.effective_plan) {
        effectivePlan = effectiveData.effective_plan === 'premium' || effectiveData.effective_plan === 'family'
          ? effectiveData.effective_plan : 'free';
      }
    } catch {
      console.warn('[regenerate-module] get_my_effective_plan threw, falling back to free plan');
    }

    const { data: sessionData, error: dbError } = await adminClient
      .from('study_sessions')
      .select('raw_ocr_text, user_id')
      .eq('id', sessionId)
      .single();

    if (dbError || !sessionData) {
      console.error('[regenerate-module] Session not found');
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Ownership check
    if (sessionData.user_id !== userId) {
      console.error('[regenerate-module] 403: owner mismatch');
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

    // --- ATOMIC USAGE GUARD ---
    const eventType = module === 'flashcards' ? 'flashcard_regen' : 'quiz_regen';
    let usageData: unknown;
    try {
      const { data, error } = await adminClient.rpc('check_and_reserve_ai_usage', {
        p_user_id: userId,
        p_session_id: sessionId,
        p_event_type: eventType,
        p_plan: effectivePlan || 'free'
      });
      if (error) {
        console.error('[regenerate-module] Usage guard DB failure');
        return usageGuardUnavailable();
      }
      usageData = data;
    } catch {
      console.error('[regenerate-module] Usage guard transport failure');
      return usageGuardUnavailable();
    }

    if (!usageData || typeof usageData !== 'object' || Array.isArray(usageData)) {
      return usageGuardUnavailable();
    }
    const usage = usageData as Record<string, unknown>;
    if (usage.allowed === false && usage.error === 'usage_limit_reached' &&
      usage.feature === eventType && typeof usage.limit === 'number' &&
      Number.isFinite(usage.limit) && typeof usage.message === 'string' && usage.message.trim()) {
      return new Response(JSON.stringify({
        error: 'usage_limit_reached', feature: usage.feature, limit: usage.limit,
        plan: effectivePlan === 'premium' || effectivePlan === 'family' ? effectivePlan : 'free',
        message: usage.message,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }
    if (usage.allowed !== true || typeof usage.reservation_id !== 'string' || usage.reservation_id.length !== 36 ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(usage.reservation_id)) {
      return usageGuardUnavailable();
    }

    reservationId = usage.reservation_id;
    cleanupReservation = async () => {
      if (!reservationId) return;
      try {
        const { error } = await adminClient.from('usage_events').delete()
          .eq('id', reservationId).eq('user_id', userId);
        if (error) {
          console.error('[regenerate-module] Reservation cleanup failure', error);
          return;
        }
        reservationId = null;
      } catch (err) {
        console.error('[regenerate-module] Reservation cleanup failure', err);
      }
    };
    // --------------------------


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

    const providerController = new AbortController();
    const providerTimeout = setTimeout(() => providerController.abort(), 60000);
    const providerStartedAt = performance.now();
    markTiming('provider_start');
    let generation;
    try {
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      signal: providerController.signal,
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

    const rawProviderText = await openAiResponse.text();
    let aiPayload: {
      error?: { type?: unknown; code?: unknown };
      choices?: { message?: { content?: string } }[];
    };
    try {
      aiPayload = JSON.parse(rawProviderText);
    } catch {
      console.error('[regenerate-module] OpenAI provider error', {
        status: openAiResponse.status, type: null, code: null, requestId,
      });
      throw new Error('provider_error');
    }
    if (!openAiResponse.ok || aiPayload?.error) {
      console.error('[regenerate-module] OpenAI provider error', {
        status: openAiResponse.status,
        type: typeof aiPayload?.error?.type === 'string' ? aiPayload.error.type : null,
        code: typeof aiPayload?.error?.code === 'string' ? aiPayload.error.code : null,
        requestId,
      });
      throw new Error('provider_error');
    }
    generation = JSON.parse(aiPayload.choices?.[0]?.message?.content ?? '');
    } catch {
      throw new Error(providerController.signal.aborted ? 'provider_timeout' : 'provider_error');
    } finally {
      clearTimeout(providerTimeout);
      markTiming('provider_done', { durationMs: Math.round(performance.now() - providerStartedAt) });
    }

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
    markTiming('db_save_start');
    const dbSaveStartedAt = performance.now();
    const { error: updateError } = await adminClient
      .from('study_sessions')
      .update(finalUpdate)
      .eq('id', sessionId);

    if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
    markTiming('db_save_done', { durationMs: Math.round(performance.now() - dbSaveStartedAt) });

    // Successful regeneration consumes the reservation created by the RPC.
    reservationId = null;
    requestStatus = 'success';

    return new Response(JSON.stringify({ success: true, module, data: finalData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    if (cleanupReservation) {
      await cleanupReservation();
    }
    const providerTimeout = error?.message === 'provider_timeout';
    const providerError = error?.message === 'provider_error';
    const errorCode = providerTimeout ? 'provider_timeout' : providerError ? 'provider_error' : 'server_error';
    console.error('[regenerate-module] Request failed', { requestId, error: errorCode });
    return new Response(JSON.stringify({ error: errorCode }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: providerTimeout ? 504 : providerError ? 502 : 500,
    });
  } finally {
    markTiming('request_done', { status: requestStatus });
  }
});
