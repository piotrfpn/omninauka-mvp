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

  try {
    console.log("--- ANALYZE-NOTES INVOCATION START ---");
    
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');

    if (!authHeader) {
      console.error("[analyze-notes] 401: Missing Authorization header");
      return new Response(JSON.stringify({ error: 'Unauthorized: missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const parts = authHeader.trim().split(/\s+/);

    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      console.error("[analyze-notes] 401: Invalid bearer format");
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid authorization format' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = parts[1].trim();

    if (!token) {
      console.error("[analyze-notes] 401: Empty token");
      return new Response(JSON.stringify({ error: 'Unauthorized: empty bearer token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Verify JWT via official Supabase JWKS pattern
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    if (!supabaseUrl) {
      console.error("[analyze-notes] 500: SUPABASE_URL missing");
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 500,
      });
    }

    const JWKS = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));

    let userId: string;
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `${supabaseUrl}/auth/v1`,
      });
      if (!payload.sub) throw new Error("Missing sub claim");
      userId = payload.sub;
    } catch (err: any) {
      console.error("[analyze-notes] 401: JWT verification failed ->", err?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: token validation failed' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 401,
      });
    }

    const body = await req.json();
    const sessionId = body.sessionId;

    if (!sessionId) {
      console.error("[analyze-notes] 400: Missing sessionId");
      return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 400
      });
    }

    // Admin client for storage + DB access (bypasses RLS)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data: sessionData, error: dbError } = await adminClient
      .from('study_sessions')
      .select('image_url, subject, user_id, raw_ocr_text')
      .eq('id', sessionId)
      .single();

    if (dbError || !sessionData) {
      console.error("[analyze-notes] 404: Session not found ->", sessionId);
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    if (sessionData.user_id !== userId) {
       console.error("[analyze-notes] 403: Ownership mismatch");
       return new Response(JSON.stringify({ error: 'Forbidden: session belongs to another user' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
       });
    }

    // Idempotency guard: skip if already processed
    if (sessionData.subject) {
      return new Response(JSON.stringify({ success: true, alreadyAnalyzed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    let ocrText = "";

    if (sessionData.raw_ocr_text && sessionData.raw_ocr_text.trim().length > 0) {
      console.log(`[analyze-notes] Found pre-extracted text for session: ${sessionId}, skipping Vision OCR`);
      ocrText = sessionData.raw_ocr_text;
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

      console.log(`[analyze-notes] Processing ${imagePaths.length} image(s) for session:`, sessionId);

      // 4. Google Cloud Vision OCR — sequential per image, concatenate results
      const GOOGLE_VISION_KEY = Deno.env.get('GOOGLE_VISION_API_KEY');
      if (!GOOGLE_VISION_KEY) throw new Error("Google Vision API Key missing");

      const ocrParts: string[] = [];

      for (let imgIdx = 0; imgIdx < imagePaths.length; imgIdx++) {
        const imgPath = imagePaths[imgIdx];
        console.log(`[analyze-notes] OCR image ${imgIdx + 1}/${imagePaths.length}: ${imgPath}`);

        // Download image from private Storage
        const { data: fileData, error: downloadError } = await adminClient.storage
          .from('study-materials')
          .download(imgPath);

        if (downloadError || !fileData) {
          console.error(`[analyze-notes] Storage download failed for image ${imgIdx + 1} ->`, downloadError?.message);
          // Non-fatal for multi-image: log and skip this image
          if (imagePaths.length === 1) {
            return new Response(JSON.stringify({ error: `Storage download failed: ${downloadError?.message || 'no payload'}` }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            });
          }
          ocrParts.push(`[Strona ${imgIdx + 1}: błąd pobierania obrazu]`);
          continue;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        if (bytes.length === 0) {
          console.error(`[analyze-notes] Empty image payload for image ${imgIdx + 1}`);
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
        let visionData: any = {};
        try {
          visionData = JSON.parse(rawVisionText);
        } catch(e) {
          console.error(`[analyze-notes] Vision response not valid JSON for image ${imgIdx + 1}`);
        }

        const topLevelError = visionData.error;
        const responsesExist = Array.isArray(visionData.responses) && visionData.responses.length > 0;
        const responseItem = responsesExist ? visionData.responses[0] : null;
        const hasVisionError = !!responseItem?.error;

        if (!visionResponse.ok || topLevelError || hasVisionError) {
          const exactMessage = topLevelError?.message || responseItem?.error?.message || "Unknown Error";
          console.error(`[analyze-notes] Vision error for image ${imgIdx + 1} ->`, exactMessage);
          // Fatal only for single-image sessions
          if (imagePaths.length === 1) {
            return new Response(JSON.stringify({ error: `Google Vision error: ${exactMessage}` }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 502
            });
          }
          ocrParts.push(`[Strona ${imgIdx + 1}: błąd OCR - ${exactMessage}]`);
          continue;
        }

        const pageText = responseItem?.fullTextAnnotation?.text || "";
        console.log(`[analyze-notes] Image ${imgIdx + 1} OCR chars:`, pageText.length);

        if (pageText.trim().length > 0) {
          ocrParts.push(imgIdx === 0 ? pageText : `--- Strona ${imgIdx + 1} ---\n${pageText}`);
        }
      }

      // Combine all OCR text
      ocrText = ocrParts.join('\n\n');
      console.log("[analyze-notes] Total OCR chars before cap:", ocrText.length);

      // Cost protection: cap combined OCR at 8000 chars to avoid OpenAI context overflow
      const OCR_CHAR_CAP = 8000;
      if (ocrText.length > OCR_CHAR_CAP) {
        console.warn(`[analyze-notes] OCR text truncated from ${ocrText.length} to ${OCR_CHAR_CAP} chars`);
        ocrText = ocrText.substring(0, OCR_CHAR_CAP) + '\n[...tekst obcięty - za długi materiał]';
      }

      if (!ocrText || ocrText.trim().length === 0) {
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
   - Jeśli materiał jest krótki (< 200 słów): wygeneruj 3–5 fiszek.
   - Jeśli materiał jest średni (200–600 słów): wygeneruj 6–10 fiszek.
   - Jeśli materiał jest długi (> 600 słów): wygeneruj 10–15 fiszek.
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
    let aiData: any = {};
    try {
      aiData = JSON.parse(rawAiText);
    } catch (e) {
      console.error("[analyze-notes] OpenAI response not valid JSON");
      return new Response(JSON.stringify({ error: "AI processing error: invalid response format" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502
      });
    }

    if (aiData.error) {
      console.error("[analyze-notes] 502: OpenAI API error ->", aiData.error?.message);
      return new Response(JSON.stringify({ error: `OpenAI API error: ${aiData.error?.message || 'Unknown'}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502
      });
    }

    if (!openAiResponse.ok) {
      console.error("[analyze-notes] OpenAI non-ok status ->", openAiResponse.status);
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
         return new Response(JSON.stringify({ error: "AI processing error: unexpected response shape" }), {
           headers: { ...corsHeaders, 'Content-Type': 'application/json' },
           status: 502
         });
      }
    } catch (parseErr: any) {
       console.error("[analyze-notes] JSON.parse failed ->", parseErr?.message);
       return new Response(JSON.stringify({ error: `AI processing error: JSON parse failed` }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 502
       });
    }

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

    if (updateError) throw new Error(`DB Update failed: ${updateError.message}`);

    return new Response(JSON.stringify({ success: true, sessionId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown server error" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
