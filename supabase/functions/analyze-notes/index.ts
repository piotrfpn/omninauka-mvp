import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Authenticate Request via Auth Client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { sessionId } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 400 
      });
    }

    // 2. Initialize Admin Service Client for Secure Internal Database/Storage Operations
    // (Bypasses UI-level RLS restrictions inside trusted server environment)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch Session
    const { data: sessionData, error: dbError } = await adminClient
      .from('study_sessions')
      .select('image_url, subject')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (dbError || !sessionData) {
      return new Response(JSON.stringify({ error: 'Session not found or forbidden' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    // Idempotency Check: Don't double-charge APIs if already processed
    if (sessionData.subject) {
      return new Response(JSON.stringify({ success: true, alreadyAnalyzed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // 3. Download Base64 payload from private Storage securely via Admin
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from('study-materials')
      .download(sessionData.image_url);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download image securely: ${downloadError?.message}`);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // 4. Trigger Google Cloud Vision OCR
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

    const visionData = await visionResponse.json();
    const ocrText = visionData.responses?.[0]?.fullTextAnnotation?.text || "";

    // Gracefully handle empty images (e.g. blurry/blank pages)
    if (!ocrText || ocrText.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Nie wykryto żadnego tekstu na zdjęciu." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 422
      });
    }

    // 5. Send to OpenAI for structured generation
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
            content: `You are an expert Polish educational AI. You receive absolute raw OCR text. Extract and structure studying materials identically to the provided JSON schema. Output ONLY valid JSON.
Schema:
{
  "subject": "String (e.g. Biologia)",
  "topic": "String (e.g. Budowa Komórki)",
  "summary": "String (A high-level educational summary)",
  "keyConcepts": [
     { "term": "String", "definition": "String", "category": "definition" | "date" | "formula" | "person" | "event" | "concept" }
  ],
  "flashcards": [
     { "front": "String", "back": "String", "difficulty": "easy" | "medium" | "hard" }
  ],
  "quizQuestions": [
     { "question": "String", "options": ["String", "String", "String", "String"], "correctIndex": "Number (0-3)", "explanation": "String", "difficulty": "easy" | "medium" | "hard" }
  ]
}`
          },
          { role: "user", content: `Raw OCR Text:\n${ocrText}` }
        ],
        temperature: 0.2
      })
    });

    const aiData = await openAiResponse.json();
    let parsedGeneration: any = {};
    
    // Schema Safety Guard
    try {
      if (aiData.choices && aiData.choices[0] && aiData.choices[0].message) {
         parsedGeneration = JSON.parse(aiData.choices[0].message.content);
      } else {
         throw new Error("Invalid OpenAI response shape");
      }
    } catch (parseErr) {
       console.error("OpenAI JSON Parse Failure.", aiData);
       throw new Error("Wystąpił błąd podczas interpretacji tekstu przez AI.");
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
