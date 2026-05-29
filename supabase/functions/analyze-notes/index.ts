import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } from "npm:jose";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let markTimingFn: ((stage: string, extra?: Record<string, unknown>) => void) | null = null;

  try {
    const requestStartedAt = performance.now();
    const requestId = crypto.randomUUID();

    const markTiming = (stage: string, extra?: Record<string, unknown>) => {
      const now = performance.now();
      const elapsedMs = Math.round(now - requestStartedAt);
      const payload = {
        marker: 'analyze-notes-timing',
        requestId,
        stage,
        elapsedMs,
        ...(extra ?? {}),
      };
      console.info(JSON.stringify(payload));
    };

    markTimingFn = markTiming;

    markTiming('request_start');
    console.log("--- ANALYZE-NOTES INVOCATION START ---");
    
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) {
      console.error("[analyze-notes] 401: Missing Authorization header");
      markTiming('response_ready', { status: 'error', errorCode: 'auth_failed' });
      markTiming('request_done', { status: 'error' });
      return new Response(JSON.stringify({ error: 'Unauthorized: missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[analyze-notes] 500: Server configuration missing");
      markTiming('response_ready', { status: 'error', errorCode: 'unknown_error' });
      markTiming('request_done', { status: 'error' });
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 500,
      });
    }

    // User client for plan check + RLS context
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Admin client for profile + storage + DB access (bypasses RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Verify user identity
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("[analyze-notes] 401: Auth verification failed");
      markTiming('response_ready', { status: 'error', errorCode: 'auth_failed' });
      markTiming('request_done', { status: 'error' });
      return new Response(JSON.stringify({ error: 'Unauthorized: token validation failed' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 401,
      });
    }
    const userId = user.id;

    // Verify user account status and plan
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('age_band, account_status, plan, plan_expires_at')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error("[analyze-notes] 404: Profile not found");
      markTiming('response_ready', { status: 'error', errorCode: 'auth_failed' });
      markTiming('request_done', { status: 'error' });
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    if (
      (profile.age_band === '13_15' && profile.account_status === 'pending_parent_consent') ||
      profile.account_status === 'parent_withdrawn' ||
      profile.account_status === 'suspended'
    ) {
      console.warn(`[analyze-notes] 403: Access blocked for status ${profile.account_status}`);
      markTiming('response_ready', { status: 'error', errorCode: 'auth_failed' });
      markTiming('request_done', { status: 'error' });
      return new Response(JSON.stringify({ 
        error: `Dostęp zablokowany: status konta ${profile.account_status}` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    markTiming('auth_check');

    // --- USAGE LIMITS GUARD (Sprint 23A) ---
    // We use get_my_effective_plan() to respect inherited family plans.
    let effectivePlan = 'free';
    try {
      const { data: effectiveData, error: planError } = await supabaseClient
        .rpc('get_my_effective_plan');

      if (planError) {
        console.warn('[analyze-notes] get_my_effective_plan failed in analyze-notes, falling back to free');
      } else if (effectiveData?.effective_plan) {
        effectivePlan = effectiveData.effective_plan;
      }
    } catch (err) {
      console.warn('[analyze-notes] get_my_effective_plan threw in analyze-notes, falling back to free');
    }
    const dailyLimit = (effectivePlan === 'premium' || effectivePlan === 'family') ? 10 : 2;
    const maxCards = (effectivePlan === 'premium' || effectivePlan === 'family') ? 20 : 5;

    // Count today's lessons (UTC)
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const { count: usageCount, error: usageError } = await adminClient
      .from('usage_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'lesson_analysis')
      .gte('created_at', startOfToday.toISOString());

    if (usageError) {
      console.error("[analyze-notes] Usage count error");
    }

    if ((usageCount || 0) >= dailyLimit) {
      console.warn(`[analyze-notes] 403: Usage limit reached`);
      markTiming('response_ready', { status: 'error', errorCode: 'auth_failed' });
      markTiming('request_done', { status: 'error' });
      return new Response(JSON.stringify({ 
        error: "usage_limit_reached",
        feature: "ai_lessons",
        limit: dailyLimit,
        plan: effectivePlan === 'family' || effectivePlan === 'premium' ? 'premium' : 'free',
        message: effectivePlan === 'free' 
          ? "Osiągnąłeś dzienny limit lekcji AI w planie Darmowym. Sprawdź Premium, aby korzystać z większego limitu."
          : "Osiągnąłeś dzienny limit lekcji AI dla swojego planu (fair use)."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }
    // --------------------------

    const body = await req.json();
    const sessionId = body.sessionId;

    if (!sessionId) {
      console.error("[analyze-notes] 400: Missing sessionId");
      markTiming('response_ready', { status: 'error', errorCode: 'missing_session_id' });
      markTiming('request_done', { status: 'error' });
      return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 400
      });
    }

    markTiming('parse_payload');

    const { data: sessionData, error: dbError } = await adminClient
      .from('study_sessions')
      .select('image_url, subject, user_id, raw_ocr_text')
      .eq('id', sessionId)
      .single();

    if (dbError || !sessionData) {
      console.error("[analyze-notes] 404: Session not found");
      markTiming('response_ready', { status: 'error', errorCode: 'session_not_found' });
      markTiming('request_done', { status: 'error' });
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    if (sessionData.user_id !== userId) {
       console.error("[analyze-notes] 403: Ownership mismatch");
       markTiming('response_ready', { status: 'error', errorCode: 'auth_failed' });
       markTiming('request_done', { status: 'error' });
       return new Response(JSON.stringify({ error: 'Forbidden: session belongs to another user' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
       });
    }

    markTiming('load_session');

    // Idempotency guard: skip if already processed
    if (sessionData.subject) {
      markTiming('response_ready', { status: 'success' });
      markTiming('request_done', { status: 'success' });
      return new Response(JSON.stringify({ success: true, alreadyAnalyzed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    let ocrText = "";

    if (sessionData.raw_ocr_text && sessionData.raw_ocr_text.trim().length > 0) {
      console.log('[analyze-notes] Found pre-extracted text, skipping Vision OCR');
      ocrText = sessionData.raw_ocr_text;
      markTiming('ocr_skipped', { totalChars: ocrText.length });
    } else {
      // 3. Collect all image paths for this session
      // Primary image from study_sessions.image_url (always present for backward compat)
      // Additional images from session_images child table (Sprint 2)
      const imagePaths: string[] = [];

      if (sessionData.image_url) {
        imagePaths.push(sessionData.image_url);
      }

      const { data: childImages } = await adminClient
        .from('session_images')
        .select('image_url, position')
        .eq('session_id', sessionId)
        .order('position', { ascending: true });

      if (childImages && childImages.length > 0) {
        for (const ci of childImages) {
          if (ci.image_url && !imagePaths.includes(ci.image_url)) {
            imagePaths.push(ci.image_url);
          }
        }
      }

      console.log('[analyze-notes] Processing images for OCR', { imageCount: imagePaths.length });

      markTiming('ocr_start', { imageCount: imagePaths.length });

      // 4. Google Cloud Vision OCR — sequential per image, concatenate results
      const GOOGLE_VISION_KEY = Deno.env.get('GOOGLE_VISION_API_KEY');
      if (!GOOGLE_VISION_KEY) throw new Error("Google Vision API Key missing");

      const ocrParts: string[] = [];

      for (let imgIdx = 0; imgIdx < imagePaths.length; imgIdx++) {
        const imgPath = imagePaths[imgIdx];
        console.log('[analyze-notes] OCR image started', { imgIdx, totalImages: imagePaths.length });

        const downloadStart = performance.now();
        markTiming('load_storage_file_start', { imgIdx, totalImages: imagePaths.length });

        // Download image from private Storage
        const { data: fileData, error: downloadError } = await adminClient.storage
          .from('study-materials')
          .download(imgPath);

        const downloadDuration = Math.round(performance.now() - downloadStart);

        if (downloadError || !fileData) {
          console.error('[analyze-notes] Storage download failed');
          markTiming('load_storage_file_failed', {
            imgIdx,
            totalImages: imagePaths.length,
            durationMs: downloadDuration,
            errorCode: 'storage_download_failed'
          });
          // Non-fatal for multi-image: log and skip this image
          if (imagePaths.length === 1) {
            markTiming('response_ready', { status: 'error', errorCode: 'storage_download_failed' });
            markTiming('request_done', { status: 'error' });
            return new Response(JSON.stringify({ error: `Storage download failed: ${downloadError?.message || 'no payload'}` }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            });
          }
          ocrParts.push(`[Strona ${imgIdx + 1}: błąd pobierania obrazu]`);
          continue;
        }

        markTiming('load_storage_file_done', {
          imgIdx,
          totalImages: imagePaths.length,
          durationMs: downloadDuration,
          fileSize: fileData.size
        });

        const arrayBuffer = await fileData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        if (bytes.length === 0) {
          console.error('[analyze-notes] Empty image payload');
          ocrParts.push(`[Strona ${imgIdx + 1}: pusty plik]`);
          continue;
        }

        // Convert to base64
        let binary = '';
        const chunkSize = 32768;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        const base64Image = btoa(binary);

        const ocrCallStart = performance.now();
        markTiming('ocr_call_start', { imgIdx, totalImages: imagePaths.length });

        // Call Google Vision OCR
        const visionResponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [{
              image: { content: base64Image },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
            }]
          })
        });

        const rawVisionText = await visionResponse.text();
        const ocrCallDuration = Math.round(performance.now() - ocrCallStart);

        let visionData: any = {};
        try {
          visionData = JSON.parse(rawVisionText);
        } catch(e) {
          console.error('[analyze-notes] Vision response not valid JSON');
        }

        const topLevelError = visionData.error;
        const responsesExist = Array.isArray(visionData.responses) && visionData.responses.length > 0;
        const responseItem = responsesExist ? visionData.responses[0] : null;
        const hasVisionError = !!responseItem?.error;

        if (!visionResponse.ok || topLevelError || hasVisionError) {
          console.error('[analyze-notes] Vision OCR failed');
          markTiming('ocr_call_failed', {
            imgIdx,
            totalImages: imagePaths.length,
            durationMs: ocrCallDuration,
            errorCode: 'ocr_failed'
          });
          // Fatal only for single-image sessions
          if (imagePaths.length === 1) {
            markTiming('response_ready', { status: 'error', errorCode: 'ocr_failed' });
            markTiming('request_done', { status: 'error' });
            return new Response(JSON.stringify({ error: 'Google Vision error: ocr_failed' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 502
            });
          }
          ocrParts.push(`[Strona ${imgIdx + 1}: nie udało się odczytać tekstu]`);
          continue;
        }

        const pageText = responseItem?.fullTextAnnotation?.text || "";
        console.log('[analyze-notes] Image OCR chars completed', { charsCount: pageText.length });

        markTiming('ocr_call_done', {
          imgIdx,
          totalImages: imagePaths.length,
          durationMs: ocrCallDuration,
          charsCount: pageText.length
        });

        if (pageText.trim().length > 0) {
          ocrParts.push(imgIdx === 0 ? pageText : `--- Strona ${imgIdx + 1} ---\n${pageText}`);
        }
      }

      // Combine all OCR text
      ocrText = ocrParts.join('\n\n');
      console.log('[analyze-notes] Total OCR chars completed', { totalChars: ocrText.length });

      // Cost protection: cap combined OCR at 8000 chars to avoid OpenAI context overflow
      const OCR_CHAR_CAP = 8000;
      if (ocrText.length > OCR_CHAR_CAP) {
        console.warn(`[analyze-notes] OCR text truncated from ${ocrText.length} to ${OCR_CHAR_CAP} chars`);
        ocrText = ocrText.substring(0, OCR_CHAR_CAP) + '\n[...tekst obcięty - za długi materiał]';
      }

      markTiming('ocr_done', {
        totalImages: imagePaths.length,
        totalChars: ocrText.length
      });

      if (!ocrText || ocrText.trim().length === 0) {
        markTiming('response_ready', { status: 'error', errorCode: 'ocr_failed' });
        markTiming('request_done', { status: 'error' });
        return new Response(JSON.stringify({ error: "Nie wykryto żadnego tekstu na zdjęciach." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 422
        });
      }
    }


    // Quiz mode configuration — allows future quick/standard/extended support
    // quizMode: 'quick' = 8 questions | 'standard' = 12 | 'extended' = 20
    const QUIZ_MODE = 'standard';
    const QUIZ_COUNTS: Record<string, { easy: number; medium: number; hard: number }> = {
      quick:    { easy: 3, medium: 3, hard: 2 },
      standard: { easy: 4, medium: 5, hard: 3 },
      extended: { easy: 6, medium: 9, hard: 5 },
    };
    const qc = QUIZ_COUNTS[QUIZ_MODE];
    const totalQuiz = qc.easy + qc.medium + qc.hard;

    // 5. OpenAI structured generation
    const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_KEY) throw new Error("OpenAI API Key missing");

    markTiming('openai_analysis_start', {
      inputChars: ocrText.length,
      maxCards,
      totalQuiz
    });

    const openAiStart = performance.now();
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Jesteś ekspertem edukacyjnym tworzącym wysokiej jakości materiały do nauki w języku polskim. Otrzymujesz surowy tekst OCR z notatek. Wyodrębnij i ustrukturyzuj dane w podanym schemacie JSON. Zwróć TYLKO poprawny JSON, bez żadnego dodatkowego tekstu.

SCHEMA:
{
  "subject": "String (np. Biologia)",
  "topic": "String (np. Budowa Komórki)",
  "summary": "String (2-4 zdania po polsku)",
  "keyConcepts": [
     { "term": "String", "definition": "String", "category": "definition" | "date" | "formula" | "person" | "event" | "concept" }
  ],
  "flashcards": [
     { "front": "String", "back": "String", "difficulty": "easy" | "medium" | "hard" }
  ],
  "quizQuestions": [
     { "question": "String", "options": ["String", "String", "String", "String"], "correctIndex": number (0-3), "explanation": "String", "difficulty": "easy" | "medium" | "hard" }
  ]
}

ZASADY FISZEK — KRYTYCZNE, MUSZĄ BYĆ BEZWZGLĘDNIE PRZESTRZEGANE:

1. UNIKALNOŚĆ: Każda fiszka musi dotyczyć INNEGO faktu, pojęcia lub zależności.
   - ZAKAZ tworzenia dwóch fiszek o tym samym znaczeniu, nawet innymi słowami.
   - ZAKAZ fiszek, których odpowiedź jest wariantem innej fiszki.
   - Przed dodaniem nowej fiszki sprawdź, czy nie pokrywa się z już dodaną.

2. RÓŻNORODNOŚĆ TYPÓW — obowiązkowo mieszaj poniższe kategorie:
   a) Definicja: "Co to jest X?" → zwięzła definicja
   b) Przykład: "Przykład zastosowania X?" → konkretny przykład z życia
   c) Porównanie: "Czym różni się A od B?" → kluczowe różnice
   d) Przyczyna-skutek: "Dlaczego X prowadzi do Y?" → mechanizm
   e) Dane twarde: osoba / data / wzór / kluczowy termin
   f) Zastosowanie: "Gdzie wykorzystuje się X?" → kontekst praktyczny
   Nie generuj wyłącznie fiszek typu definicja.

3. DYNAMICZNA ILOŚĆ:
   - Maksymalna liczba fiszek dla tego użytkownika: ${maxCards}.
   - Jeśli materiał jest krótki (< 200 słów): wygeneruj 3–5 fiszek.
   - Jeśli materiał jest średni (200–600 słów): wygeneruj 6–${Math.min(10, maxCards)} fiszek.
   - Jeśli materiał jest długi (> 600 słów): wygeneruj 10–${maxCards} fiszek.
   - NIE twórz "zapychaczy" tylko po to, żeby dobić do limitu.
   - Jakość i unikalność > ilość.

4. FORMAT FISZKI:
   - front: pytanie lub hasło (max 120 znaków, po polsku)
   - back: odpowiedź (zwięzła, konkretna, po polsku)
   - difficulty: easy / medium / hard (proporcjonalnie)

ZASADY QUIZU — KRYTYCZNE, MUSZĄ BYĆ BEZWZGLĘDNIE PRZESTRZEGANE:
- Wygeneruj DOKŁADNIE ${totalQuiz} pytań quizowych.
- Rozkład trudności MUSI wynosić: ${qc.easy} easy, ${qc.medium} medium, ${qc.hard} hard.
- Kolejność: najpierw easy, potem medium, potem hard.
- Każde pytanie musi mieć DOKŁADNIE 4 opcje odpowiedzi.
- correctIndex musi być liczbą 0-3 (nie stringiem).
- Każde pytanie musi zawierać polskie wyjaśnienie dlaczego poprawna odpowiedź jest właściwa.
- Pytania muszą testować zrozumienie, nie powierzchowne czytanie.
- Nie powtarzaj pytań ani nie parafrazuj tego samego faktu.
- Cały tekst (pytania, opcje, wyjaśnienia) musi być po polsku.`
          },
          { role: "user", content: `Tekst OCR do analizy:\n${ocrText}` }
        ],
        temperature: 0.2,
        max_tokens: 4000
      })
    });

    const rawAiText = await openAiResponse.text();
    const openAiDuration = Math.round(performance.now() - openAiStart);
    let aiData: any = {};
    try {
      aiData = JSON.parse(rawAiText);
    } catch (e) {
      console.error("[analyze-notes] OpenAI response not valid JSON");
      markTiming('openai_analysis_failed', {
        durationMs: openAiDuration,
        errorCode: 'ai_analysis_failed'
      });
      markTiming('response_ready', { status: 'error', errorCode: 'ai_analysis_failed' });
      markTiming('request_done', { status: 'error' });
      return new Response(JSON.stringify({ error: "AI processing error: invalid response format" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502
      });
    }

    if (aiData.error) {
      console.error("[analyze-notes] 502: OpenAI API error");
      markTiming('openai_analysis_failed', {
        durationMs: openAiDuration,
        errorCode: 'ai_analysis_failed'
      });
      markTiming('response_ready', { status: 'error', errorCode: 'ai_analysis_failed' });
      markTiming('request_done', { status: 'error' });
      return new Response(JSON.stringify({ error: "OpenAI API error: ai_analysis_failed" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502
      });
    }

    if (!openAiResponse.ok) {
      console.error("[analyze-notes] OpenAI non-ok status ->", openAiResponse.status);
      markTiming('openai_analysis_failed', {
        durationMs: openAiDuration,
        errorCode: 'ai_analysis_failed'
      });
      markTiming('response_ready', { status: 'error', errorCode: 'ai_analysis_failed' });
      markTiming('request_done', { status: 'error' });
      return new Response(JSON.stringify({ error: `OpenAI HTTP error ${openAiResponse.status}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502
      });
    }

    const hasContent = Array.isArray(aiData.choices) && !!aiData.choices[0]?.message?.content;

    let parsedGeneration: any = {};
    try {
      if (hasContent) {
         parsedGeneration = JSON.parse(aiData.choices[0].message.content);
      } else {
         console.error("[analyze-notes] OpenAI unexpected response shape");
         markTiming('openai_analysis_failed', {
           durationMs: openAiDuration,
           errorCode: 'ai_analysis_failed'
         });
         markTiming('response_ready', { status: 'error', errorCode: 'ai_analysis_failed' });
         markTiming('request_done', { status: 'error' });
         return new Response(JSON.stringify({ error: "AI processing error: unexpected response shape" }), {
           headers: { ...corsHeaders, 'Content-Type': 'application/json' },
           status: 502
         });
      }
    } catch (parseErr: any) {
       console.error("[analyze-notes] JSON.parse failed");
       markTiming('openai_analysis_failed', {
         durationMs: openAiDuration,
         errorCode: 'ai_analysis_failed'
       });
       markTiming('response_ready', { status: 'error', errorCode: 'ai_analysis_failed' });
       markTiming('request_done', { status: 'error' });
       return new Response(JSON.stringify({ error: `AI processing error: JSON parse failed` }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 502
       });
    }

    markTiming('openai_analysis_done', {
      durationMs: openAiDuration,
      conceptsCount: parsedGeneration.keyConcepts?.length ?? 0,
      flashcardsCount: parsedGeneration.flashcards?.length ?? 0,
      quizQuestionsCount: parsedGeneration.quizQuestions?.length ?? 0
    });

    // ── Deduplication helpers ─────────────────────────────────────────────────

    // Normalise a string for comparison: lowercase, collapse whitespace, remove punctuation
    const normalise = (s: string): string =>
      (s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();

    // Tokenise into a Set of words (words ≥ 3 chars to skip stopwords)
    const tokenSet = (s: string): Set<string> =>
      new Set(normalise(s).split(' ').filter(w => w.length >= 3));

    // Jaccard similarity between two strings (0 = no overlap, 1 = identical)
    const jaccard = (a: string, b: string): number => {
      const sa = tokenSet(a);
      const sb = tokenSet(b);
      if (sa.size === 0 && sb.size === 0) return 1;
      if (sa.size === 0 || sb.size === 0) return 0;
      let intersection = 0;
      for (const t of sa) { if (sb.has(t)) intersection++; }
      return intersection / (sa.size + sb.size - intersection);
    };

    // Deduplicate flashcards:
    // Remove a card if its front OR back is ≥ 0.75 Jaccard similar to an already-kept card.
    const deduplicateFlashcards = (cards: any[]): any[] => {
      const kept: any[] = [];
      for (const card of cards) {
        const frontN = normalise(card.front ?? '');
        const backN  = normalise(card.back  ?? '');
        if (!frontN && !backN) continue;          // skip empty
        let isDuplicate = false;
        for (const k of kept) {
          const frontSim = jaccard(frontN, normalise(k.front ?? ''));
          const backSim  = jaccard(backN,  normalise(k.back  ?? ''));
          if (frontSim >= 0.75 || backSim >= 0.75) {
            isDuplicate = true;
            break;
          }
        }
        if (!isDuplicate) kept.push(card);
      }
      return kept;
    };

    // Deduplicate quiz questions on the `question` field only (answers can overlap)
    const deduplicateQuiz = (questions: any[]): any[] => {
      const kept: any[] = [];
      for (const q of questions) {
        const qN = normalise(q.question ?? '');
        if (!qN) continue;
        const isDuplicate = kept.some(k => jaccard(qN, normalise(k.question ?? '')) >= 0.75);
        if (!isDuplicate) kept.push(q);
      }
      return kept;
    };

    // ── Ensure strict arrays, then deduplicate ────────────────────────────────
    const key_concepts = Array.isArray(parsedGeneration.keyConcepts) ? parsedGeneration.keyConcepts : [];
    const rawFlashcards   = Array.isArray(parsedGeneration.flashcards)    ? parsedGeneration.flashcards    : [];
    const rawQuizQuestions = Array.isArray(parsedGeneration.quizQuestions) ? parsedGeneration.quizQuestions : [];

    const flashcards     = deduplicateFlashcards(rawFlashcards);
    const quiz_questions = deduplicateQuiz(rawQuizQuestions);

    console.log(`[analyze-notes] Flashcards: ${rawFlashcards.length} raw → ${flashcards.length} after dedup`);
    console.log(`[analyze-notes] Quiz questions: ${rawQuizQuestions.length} raw → ${quiz_questions.length} after dedup`);

    // 6. Save generated results to Postgres securely via Admin Client
    markTiming('db_update_start');
    const dbUpdateStart = performance.now();

    const { error: updateError } = await adminClient
      .from('study_sessions')
      .update({
        raw_ocr_text: ocrText,
        subject: parsedGeneration.subject || "Nieznany Przedmiot",
        topic: parsedGeneration.topic || "Nieznany Temat",
        summary: parsedGeneration.summary || "Brak podsumowania.",
        key_concepts,
        flashcards,
        quiz_questions,
        confidence: 0.95
      })
      .eq('id', sessionId);

    const dbUpdateDuration = Math.round(performance.now() - dbUpdateStart);

    if (updateError) {
      markTiming('db_update_failed', {
        durationMs: dbUpdateDuration,
        errorCode: 'db_update_failed'
      });
      throw new Error(`DB Update failed: ${updateError.message}`);
    }

    markTiming('db_update_done', {
      durationMs: dbUpdateDuration
    });

    // Log usage event on success
    await adminClient.from('usage_events').insert({
      user_id: userId,
      event_type: 'lesson_analysis',
      session_id: sessionId,
      metadata: { effectivePlan }
    });

    markTiming('response_ready', { status: 'success' });
    markTiming('request_done', { status: 'success' });

    return new Response(JSON.stringify({ success: true, sessionId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    let safeErrorCode = 'unknown_error';
    const errMsg = (error?.message || '').toLowerCase();
    if (errMsg.includes('auth')) {
      safeErrorCode = 'auth_failed';
    } else if (errMsg.includes('missing session')) {
      safeErrorCode = 'missing_session_id';
    } else if (errMsg.includes('session not found')) {
      safeErrorCode = 'session_not_found';
    } else if (errMsg.includes('download failed') || errMsg.includes('storage')) {
      safeErrorCode = 'storage_download_failed';
    } else if (errMsg.includes('vision') || errMsg.includes('ocr')) {
      safeErrorCode = 'ocr_failed';
    } else if (errMsg.includes('openai') || errMsg.includes('ai processing')) {
      safeErrorCode = 'ai_analysis_failed';
    } else if (errMsg.includes('db update') || errMsg.includes('postgres')) {
      safeErrorCode = 'db_update_failed';
    }

    if (markTimingFn) {
      markTimingFn('request_failed', { status: 'error', errorCode: safeErrorCode });
    } else {
      console.error(JSON.stringify({
        marker: 'analyze-notes-timing',
        stage: 'request_failed',
        status: 'error',
        errorCode: safeErrorCode
      }));
    }

    return new Response(JSON.stringify({ error: error?.message || "Unknown server error" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
