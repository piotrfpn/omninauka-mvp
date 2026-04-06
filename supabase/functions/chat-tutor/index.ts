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
    console.log("[chat-tutor] Invocation start");

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("[chat-tutor] 401: Missing Authorization header");
      return new Response(JSON.stringify({ error: 'Unauthorized: missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      console.error("[chat-tutor] 401: Invalid bearer format");
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid authorization format' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const token = parts[1].trim();

    // Verify JWT via official Supabase JWKS pattern (same as analyze-notes)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const JWKS = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));

    let userId: string;
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `${supabaseUrl}/auth/v1`,
      });
      if (!payload.sub) throw new Error("Missing sub claim");
      userId = payload.sub;
      console.log("[chat-tutor] Auth OK, userId:", userId);
    } catch (err: any) {
      console.error("[chat-tutor] 401: JWT verification failed ->", err?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: token validation failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Parse request payload
    const { messages, context } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Missing or invalid messages' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 400
      });
    }

    // Cost protection: last 5 messages only
    const limitedMessages = messages.slice(-5);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error("OpenAI API Key missing");

    const systemPrompt = `You are a helpful, expert AI tutor. You communicate in Polish.
Your current lesson context is:
Subject: ${context?.subject || 'Ogólne'}
Topic: ${context?.topic || 'Brak tematu'}
Summary of study material: ${context?.summary || 'Brak materiału'}

Rules:
1. Provide short, concise answers tailored for a student.
2. Formulate your responses based heavily on the 'Summary of study material' provided above.
3. Keep the conversation engaging and ask follow-up questions to check understanding.
`;

    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...limitedMessages
    ];

    // Direct OpenAI fetch — Vercel AI SDK (streamText/toDataStreamResponse) is incompatible with Supabase Edge runtime
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: allMessages,
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!openAiResponse.ok) {
      const errText = await openAiResponse.text();
      console.error("[chat-tutor] OpenAI error ->", openAiResponse.status, errText.substring(0, 300));
      return new Response(JSON.stringify({ error: `OpenAI error: ${openAiResponse.status}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502,
      });
    }

    const aiData = await openAiResponse.json();
    const replyText = aiData.choices?.[0]?.message?.content || '';

    if (!replyText) {
      console.error("[chat-tutor] Empty reply from OpenAI");
      return new Response(JSON.stringify({ error: 'Empty reply from AI' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502,
      });
    }

    console.log("[chat-tutor] Reply generated, length:", replyText.length);

    return new Response(JSON.stringify({ success: true, reply: replyText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[chat-tutor] Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown server error" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
