import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose";
import { generateConsentEmailHtml } from "../_shared/consent-email-template.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_CONSENT_EMAIL_SENDS = 5;

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

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
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL');
    const appBaseUrl = Deno.env.get('APP_BASE_URL');

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY configuration");
    }
    if (!resendFromEmail) {
      throw new Error("Missing RESEND_FROM_EMAIL configuration");
    }
    if (!appBaseUrl) {
      throw new Error("Missing APP_BASE_URL configuration");
    }

    // 1. Auth check (JWT verification)
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader || !/^Bearer\s+\S+/i.test(authHeader)) {
      return jsonResponse({ error: "Brak prawidłowej autoryzacji.", code: "unauthorized" }, 401);
    }

    const jwtToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    let payload: { sub?: string; email?: unknown };
    try {
      const JWKS = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
      const verified = await jwtVerify(jwtToken, JWKS, { issuer: `${supabaseUrl}/auth/v1` });
      payload = verified.payload;
    } catch {
      return jsonResponse({ error: "Brak prawidłowej autoryzacji.", code: "unauthorized" }, 401);
    }

    const userId = payload.sub;
    if (!userId) {
      return jsonResponse({ error: "Brak prawidłowej autoryzacji.", code: "unauthorized" }, 401);
    }

    // 2. Fetch trusted student email from Supabase Auth & profile status from database
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(userId);
    const trustedStudentEmail = normalizeEmail(authUserData?.user?.email);
    const trustedJwtEmail = normalizeEmail(payload.email);

    if (authUserError || !trustedStudentEmail) {
      return jsonResponse({ error: "Nie udało się zweryfikować konta ucznia.", code: "unauthorized" }, 401);
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('account_status, age_band, name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return jsonResponse({ error: "Profil użytkownika nie został znaleziony.", code: "profile_not_found" }, 403);
    }

    if (profile.account_status !== 'pending_parent_consent') {
      return jsonResponse(
        {
          error: `Twoje konto nie oczekuje już na zgodę rodzica (status: ${profile.account_status})`,
          code: "account_not_pending_consent",
        },
        400,
      );
    }

    // 3. Validate parent email and block student self-consent BEFORE cooldown/token/DB/email
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Niepoprawny adres e-mail rodzica", code: "invalid_parent_email" }, 400);
    }

    const rawParentEmail = typeof body?.parent_email === 'string' ? body.parent_email.trim() : '';
    const normalizedParentEmail = normalizeEmail(rawParentEmail);
    if (!normalizedParentEmail || !normalizedParentEmail.includes('@')) {
      return jsonResponse({ error: "Niepoprawny adres e-mail rodzica", code: "invalid_parent_email" }, 400);
    }

    if (
      normalizedParentEmail === trustedStudentEmail ||
      (trustedJwtEmail !== '' && normalizedParentEmail === trustedJwtEmail)
    ) {
      return jsonResponse(
        {
          error: "Podaj adres e-mail rodzica lub opiekuna — nie możesz użyć własnego adresu e-mail.",
          code: "parent_email_same_as_student",
        },
        400,
      );
    }

    // 4. Check cooldown & send limits
    const { data: existingConsent } = await adminClient
      .from('parental_consents')
      .select('last_email_sent_at, email_send_count')
      .eq('child_user_id', userId)
      .maybeSingle();

    const currentEmailSendCount = existingConsent?.email_send_count ?? 0;
    if (currentEmailSendCount >= MAX_CONSENT_EMAIL_SENDS) {
      return jsonResponse(
        {
          error: "Limit wysyłek wiadomości ze zgodą został wyczerpany. Skontaktuj się ze wsparciem.",
          code: "consent_email_limit_exceeded",
        },
        429,
      );
    }

    if (existingConsent?.last_email_sent_at) {
      const lastSent = new Date(existingConsent.last_email_sent_at).getTime();
      const now = Date.now();
      const diff = (now - lastSent) / 1000;
      if (diff < 60) {
        return jsonResponse(
          {
            error: `Poczekaj jeszcze ${Math.ceil(60 - diff)}s przed kolejną wysyłką.`,
            code: "consent_email_cooldown",
          },
          429,
        );
      }
    }

    // 5. Generate & Hash token
    const rawToken = Array.from(crypto.getRandomValues(new Uint8Array(36)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const newTokenHash = await hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 6. Upsert consent record
    const { error: upsertError } = await adminClient
      .from('parental_consents')
      .upsert({
        child_user_id: userId,
        parent_email: rawParentEmail,
        age_band: profile.age_band,
        token_hash: newTokenHash,
        token_expires_at: expiresAt.toISOString(),
        consent_status: 'pending',
        last_email_sent_at: new Date().toISOString(),
        email_send_count: currentEmailSendCount + 1,
        email_last_status: 'sending',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'child_user_id' });

    if (upsertError) throw upsertError;

    // 7. Send Email via Resend
    const consentLink = `${appBaseUrl}/consent/${rawToken}`;
    
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: rawParentEmail,
        subject: 'Zgoda na korzystanie z OmniNauka przez dziecko',
        html: generateConsentEmailHtml(profile.name, consentLink, appBaseUrl),
      }),
    });

    const resendData = await resendRes.json();
    
    if (!resendRes.ok) {
      console.error(`Resend API Error [${resendRes.status}]:`, resendData.message || resendData.name || "Unknown error");
      
      await adminClient
        .from('parental_consents')
        .update({ email_last_status: 'error', email_last_error: JSON.stringify({ status: resendRes.status, ...resendData }) })
        .eq('child_user_id', userId);
      
      let errorMsg = "Błąd usługi wysyłki e-mail.";
      if (resendRes.status === 401 || resendRes.status === 403) {
        errorMsg = "Błąd konfiguracji Resend (API Key / Sender).";
      } else if (resendRes.status === 422) {
        errorMsg = "Nieprawidłowy adres e-mail lub nadawca.";
      }
      
      return new Response(JSON.stringify({ error: errorMsg }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: resendRes.status >= 500 ? 500 : 400,
      });
    }

    await adminClient
      .from('parental_consents')
      .update({ email_last_status: 'success' })
      .eq('child_user_id', userId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: unknown) {
    // Safety check: Don't log full error if it might contain secrets (though Deno env is usually safe)
    const errMessage = err instanceof Error ? err.message : String(err);
    const safeMsg = errMessage.replace(/re_[a-zA-Z0-9]{20,}/g, "[SECRET_REDACTED]");
    console.error("send-consent-email error:", safeMsg);
    
    return new Response(JSON.stringify({ error: safeMsg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
