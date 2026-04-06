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
      .select('image_url, subject, user_id')
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

    // 3. Download image from private Storage via admin client
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from('study-materials')
      .download(sessionData.image_url);

    if (downloadError || !fileData) {
      console.error("[analyze-notes] 500: Storage download failed ->", downloadError?.message);
      return new Response(JSON.stringify({ error: `Storage download failed: ${downloadError?.message || 'no payload'}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.length === 0) {
      console.error("[analyze-notes] 400: Empty image payload");
      return new Response(JSON.stringify({ error: "Invalid/empty image payload returned from Storage" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    let binary = '';
    const chunkSize = 32768;
    for (let i = 0; i < bytes.length; i += chunkSize) {
       binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64Image = btoa(binary);

    // 4. Google Cloud Vision OCR
    const GOOGLE_VISION_KEY = Deno.env.get('GOOGLE_VISION_API_KEY');
    if (!GOOGLE_VISION_KEY) throw new Error("Google Vision API Key missing");

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
       console.error("[analyze-notes] Vision response not valid JSON");
    }

    const topLevelError = visionData.error;
    const responsesExist = Array.isArray(visionData.responses) && visionData.responses.length > 0;
    const responseItem = responsesExist ? visionData.responses[0] : null;
    const hasVisionError = !!responseItem?.error;

    if (!visionResponse.ok || topLevelError || hasVisionError) {
       const exactMessage = topLevelError?.message || responseItem?.error?.message || "Unknown Error";
       console.error("[analyze-notes] 502: Google Vision error ->", exactMessage);
       return new Response(JSON.stringify({ 
          error: `Google Vision error: ${exactMessage}`
       }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 502
       });
    }

    const ocrText = responseItem?.fullTextAnnotation?.text || "";
    console.log("[analyze-notes] OCR chars extracted:", ocrText.length);

    if (!ocrText || ocrText.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Nie wykryto żadnego tekstu na zdjęciu." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 422
      });
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
            content: `You are an expert Polish educational AI. You receive raw OCR text from study materials. Extract and structure them into the provided JSON schema. Output ONLY valid JSON, no prose.

SCHEMA:
{
  "subject": "String (e.g. Biologia)",
  "topic": "String (e.g. Budowa Komórki)",
  "summary": "String (2-4 sentence high-level summary in Polish)",
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

QUIZ RULES — CRITICAL, MUST FOLLOW EXACTLY:
- Generate EXACTLY ${totalQuiz} quiz questions total.
- Difficulty distribution MUST be: ${qc.easy} easy, ${qc.medium} medium, ${qc.hard} hard.
- Order: easy questions first, then medium, then hard.
- Each question must have EXACTLY 4 answer options.
- correctIndex must be a number 0-3 (not a string).
- Each question must include a clear Polish explanation of why the correct answer is right.
- Questions must test understanding of the material, not surface reading.
- Do not repeat questions or rephrase the same fact.
- All text (questions, options, explanations) must be in Polish.`
          },
          { role: "user", content: `Raw OCR Text:\n${ocrText}` }
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

    // Ensure strict arrays exist fallback to empty
    const key_concepts = Array.isArray(parsedGeneration.keyConcepts) ? parsedGeneration.keyConcepts : [];
    const flashcards = Array.isArray(parsedGeneration.flashcards) ? parsedGeneration.flashcards : [];
    const quiz_questions = Array.isArray(parsedGeneration.quizQuestions) ? parsedGeneration.quizQuestions : [];

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
