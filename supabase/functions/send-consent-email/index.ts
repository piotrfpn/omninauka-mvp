import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'OmniNauka <zgody@mail.omninauka.eu>';
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://omninauka.vercel.app';

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY");
    }

    // 1. Auth check
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) throw new Error("Missing Authorization header");
    
    const jwtToken = authHeader.replace('Bearer ', '').replace('bearer ', '');
    const JWKS = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
    const { payload } = await jwtVerify(jwtToken, JWKS, { issuer: `${supabaseUrl}/auth/v1` });
    const userId = payload.sub!;

    // 2. Fetch profile & check status
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('account_status, age_band, name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) throw new Error("Profile not found");

    if (profile.account_status !== 'pending_parent_consent') {
      return new Response(JSON.stringify({ error: `Niepoprawny status konta: ${profile.account_status}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 3. Check cooldown
    const { data: existingConsent } = await adminClient
      .from('parental_consents')
      .select('last_email_sent_at, email_send_count')
      .eq('child_user_id', userId)
      .maybeSingle();

    if (existingConsent?.last_email_sent_at) {
      const lastSent = new Date(existingConsent.last_email_sent_at).getTime();
      const now = Date.now();
      const diff = (now - lastSent) / 1000;
      if (diff < 60) {
        return new Response(JSON.stringify({ error: `Poczekaj jeszcze ${Math.ceil(60 - diff)}s przed kolejną wysyłką.` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429,
        });
      }
    }

    const body = await req.json();
    const parent_email = body.parent_email;
    if (!parent_email || !parent_email.includes('@')) {
      throw new Error("Niepoprawny adres e-mail rodzica");
    }

    // 4. Generate & Hash token
    // Using simple random generation (72 chars)
    const rawToken = Array.from(crypto.getRandomValues(new Uint8Array(36)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const newTokenHash = await hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 5. Upsert consent record (One Active Token logic)
    const { error: upsertError } = await adminClient
      .from('parental_consents')
      .upsert({
        child_user_id: userId,
        parent_email: parent_email,
        age_band: profile.age_band,
        token_hash: newTokenHash,
        token_expires_at: expiresAt.toISOString(),
        consent_status: 'pending',
        last_email_sent_at: new Date().toISOString(),
        email_send_count: (existingConsent?.email_send_count || 0) + 1,
        email_last_status: 'sending',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'child_user_id' });

    if (upsertError) throw upsertError;

    // 6. Send Email via Resend
    const consentLink = `${appBaseUrl}/consent/${rawToken}`;
    
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: parent_email,
        subject: 'Zgoda na korzystanie z OmniNauka przez dziecko',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #fcfcfc;">
            <h1 style="color: #4F46E5; text-align: center; margin-bottom: 30px;">OmniNauka</h1>
            <p style="font-size: 16px; color: #333;">Dzień dobry,</p>
            <p style="font-size: 16px; color: #333; line-height: 1.5;">
              Twoje dziecko, <strong>${profile.name}</strong>, utworzyło konto w aplikacji edukacyjnej <strong>OmniNauka</strong>.
            </p>
            <p style="font-size: 16px; color: #333; line-height: 1.5;">
              OmniNauka to bezpieczna platforma wspomagająca naukę z wykorzystaniem sztucznej inteligencji (AI). Aplikacja oferuje:
            </p>
            <ul style="font-size: 15px; color: #444; line-height: 1.6;">
              <li><strong>AI Tutor</strong>: interaktywne rozmowy o materiale szkolnym, pomagające zrozumieć trudne zagadnienia,</li>
              <li><strong>Analiza materiałów</strong>: pomoc w porządkowaniu notatek i dokumentów (PDF/DOCX/zdjęcia),</li>
              <li><strong>Personalizacja</strong>: dostosowanie tempa i stylu nauki do indywidualnych potrzeb ucznia.</li>
            </ul>
            <p style="font-size: 16px; color: #333; line-height: 1.5;">
              Zgodnie z przepisami RODO, aby umożliwić osobie poniżej 16 roku życia korzystanie z zaawansowanych funkcji AI, wymagana jest wyraźna zgoda rodzica lub opiekuna prawnego.
            </p>
            <div style="text-align: center; margin: 35px 0;">
              <a href="${consentLink}" style="background-color: #4F46E5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">Potwierdzam zgodę i odblokowuję konto</a>
            </div>
            <p style="color: #666; font-size: 14px; text-align: center; font-style: italic;">Link wygaśnie za 7 dni. Jeśli nie znasz tej sprawy, możesz zignorować tę wiadomość.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #999; font-size: 12px; text-align: center; line-height: 1.4;">
              PFConsulting Piotr Fiszer<br/>
              ul. Promienista 114, 60-142 Poznań, Polska<br/>
              <a href="${appBaseUrl}/regulamin" style="color: #4F46E5; text-decoration: none;">Regulamin</a> | <a href="${appBaseUrl}/polityka-prywatnosci" style="color: #4F46E5; text-decoration: none;">Polityka Prywatności</a>
            </p>
          </div>
        `,
      }),
    });

    const resendData = await resendRes.json();
    
    if (!resendRes.ok) {
      await adminClient
        .from('parental_consents')
        .update({ email_last_status: 'error', email_last_error: JSON.stringify(resendData) })
        .eq('child_user_id', userId);
      throw new Error(`Resend error: ${JSON.stringify(resendData)}`);
    }

    await adminClient
      .from('parental_consents')
      .update({ email_last_status: 'success' })
      .eq('child_user_id', userId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    console.error("send-consent-email error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
