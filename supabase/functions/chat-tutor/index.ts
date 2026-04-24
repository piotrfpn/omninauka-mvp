import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Missing authorization header");

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const JWKS = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${supabaseUrl}/auth/v1`,
    });
    const userId = payload.sub;

    const { messages, context, stream = true } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error("Missing or invalid messages");
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error("OpenAI API Key missing");

    // Phase II: Balanced Socratic Pedagogical System Prompt
    const systemPrompt = `Jesteś Osobistym Korepetytorem (Personal Tutor) w aplikacji OmniNauka. 
Twoim celem jest wspieranie ucznia (dziecko lub nastolatek) w nauce z wykorzystaniem Zrównoważonej Metody Sokratejskiej. 

REAKCJA I TON:
- Bądź wspierający, spokojny, cierpliwy i zachęcający.
- Zmniejszaj opór przed nauką - spraw, by wydawała się prostym krokiem.
- Unikaj "interrogacji" i "nieskończonych pętli pytań" – zależy nam na pomocy, a nie na zniechęcaniu ucznia.

PEDAGOGIKA (Zrównoważony Model Sokratejski):
1. ODPOWIEDŹ: Twoja odpowiedź powinna być KRÓTKA i ZWIĘZŁA.
2. PYTANIE: Zadaj DOKŁADNIE JEDNO pytanie naprowadzające/sprawdzające.
3. WSKAZÓWKA (Opcjonalnie): Jeśli temat jest trudny, dodaj małą wskazówkę przed pytaniem.
4. ADAPTACJA (Kluczowe): 
   - Jeśli uczeń prosi wprost o wyjaśnienie ("nie wiem", "wytłumacz mi"), pokazuje frustrację lub ewidentnie nie ma podstaw do odpowiedzi, PRZERWIJ metodę sokratejską.
   - W takim przypadku podaj krótki, bezpośredni i życzliwy wykład/wyjaśnienie, a dopiero potem (w kolejnym kroku) wróć do sprawdzania zrozumienia.
   - Chcemy adaptacyjnego tutoringu, nie przesłuchania.

KONTEKST LEKCJI:
Temat: ${context?.topic || 'brak'}
Podsumowanie: ${context?.summary || 'brak'}
Kluczowe pojęcia: ${JSON.stringify(context?.key_concepts || [])}
POSTĘPY UCZNIA: ${context?.mastery_summary || 'brak danych o postępach (zachowaj standardowy ton)'}

ZASADY COACHINGU:
1. Wspominaj o konkretnych błędach tylko w sposób pomocny ("Widzę, że pojęcie X sprawiało trudność...").
2. Twoje odpowiedzi muszą być zwięzłe i świetnie sformatowane pod urządzenia mobilne (krótkie akapity, max 2-3 zdania na akapit).
3. Używaj przyjaznego i zrozumiałego języka.
`;

    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-8) // Windowing for cost/performance & balanced context
    ];

    if (!stream) {
      // Standard response for non-streaming clients (legacy)
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: allMessages,
          max_tokens: 800,
          temperature: 0.5
        })
      });
      const data = await res.json();
      return new Response(JSON.stringify({ 
        success: true, 
        reply: data.choices?.[0]?.message?.content || '' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Streaming implementation (SSE)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: allMessages,
        max_tokens: 800,
        temperature: 0.5,
        stream: true
      })
    });

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

    // Just pipe the OpenAI stream directly to the client!
    return new Response(response.body, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('[chat-tutor] Error:', error);
    return new Response(JSON.stringify({ error: error?.message || "Internal server error" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
