import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateConsentEmailHtml } from "../_shared/consent-email-template.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Sanitize optional reason string: trim, max 500 chars. Return null if empty. */
const sanitizeReason = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.substring(0, 500);
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Auth Setup ───────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[admin-plan-management] Missing critical environment variables');
      return jsonResponse({ error: 'Internal server configuration error' }, 500);
    }

    // ── 2. Verify JWT and get requesting user ──────────────────────────────────
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: requestingUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !requestingUser) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const requestingEmail = requestingUser.email?.toLowerCase().trim() ?? '';
    const requestingUserId = requestingUser.id;

    // ── 3. Parse request body ──────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (!action || typeof action !== 'string') {
      return jsonResponse({ error: 'Missing or invalid action' }, 400);
    }

    // ── 4. Check ADMIN_EMAILS allowlist ────────────────────────────────────────
    const adminEmailsEnv = Deno.env.get('ADMIN_EMAILS') ?? '';
    if (!adminEmailsEnv) {
      console.error('[admin-plan-management] ADMIN_EMAILS secret not configured');
      return jsonResponse({ error: 'Admin access not configured' }, 500);
    }

    const adminEmails = adminEmailsEnv
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    const isAdmin = adminEmails.includes(requestingEmail);

    if (action === 'check_admin') {
      return jsonResponse({ isAdmin });
    }

    if (!isAdmin) {
      return jsonResponse({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    // ── 5. Admin is verified — use service client for all operations ───────────
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // ── 6. Helpers ─────────────────────────────────────────────────────────────

    /** Fetch minimal user profile — no sensitive fields. */
    const fetchUserProfile = async (userId: string) => {
      const { data, error } = await adminClient
        .from('profiles')
        .select('id, email, plan, plan_expires_at, plan_updated_at, created_at')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    };

    /** Write an audit log entry. Throws on failure so the caller can handle it. */
    const writeAuditLog = async (params: {
      action_type: string;
      target_user_id: string;
      target_email: string;
      old_plan: string | null;
      new_plan: string | null;
      old_plan_expires_at: string | null;
      new_plan_expires_at: string | null;
      reason: string | null;
    }) => {
      const { error } = await adminClient
        .from('admin_plan_actions')
        .insert({
          admin_user_id: requestingUserId,
          admin_email: requestingEmail,
          target_user_id: params.target_user_id,
          target_email: params.target_email,
          action_type: params.action_type,
          old_plan: params.old_plan,
          new_plan: params.new_plan,
          old_plan_expires_at: params.old_plan_expires_at,
          new_plan_expires_at: params.new_plan_expires_at,
          reason: params.reason,
        });
      if (error) {
        console.error('[admin-plan-management] audit log insert failed:', error.message);
        throw new Error('Audit log insert failed');
      }
    };

    // ── 7. search_user ─────────────────────────────────────────────────────────
    if (action === 'search_user') {
      const query = body.query;
      if (!query || typeof query !== 'string') {
        return jsonResponse({ error: 'Missing query parameter' }, 400);
      }

      // Sanitization: remove % and _ to prevent massive dumps, trim
      const sanitizedQuery = query.replace(/[%_]/g, '').trim();

      if (sanitizedQuery.length < 3) {
        return jsonResponse({ error: 'Fraza wyszukiwania musi mieć minimum 3 znaki' }, 400);
      }

      const ilikePattern = `%${sanitizedQuery}%`;

      const { data: users, error: searchError } = await adminClient
        .from('profiles')
        .select('id, email, name, plan, plan_expires_at, user_role, created_at, account_status')
        .or(`email.ilike.${ilikePattern},name.ilike.${ilikePattern}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (searchError) {
        console.error('[admin-plan-management] search_user error:', searchError.message);
        return jsonResponse({ error: 'Database query error' }, 500);
      }

      return jsonResponse({ users: users ?? [] });
    }

    // ── 7.5 get_user_details ───────────────────────────────────────────────────
    if (action === 'get_user_details') {
      const { userId } = body;
      if (!userId || typeof userId !== 'string') {
        return jsonResponse({ error: 'Missing userId parameter' }, 400);
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        return jsonResponse({ error: 'Invalid userId format' }, 400);
      }

      const { data: userProfile, error: userError } = await adminClient
        .from('profiles')
        .select('id, email, name, plan, plan_expires_at, plan_updated_at, created_at, account_status, age_band, user_role')
        .eq('id', userId)
        .maybeSingle();

      if (userError) {
        console.error('[admin-plan-management] get_user_details error:', userError.message);
        return jsonResponse({ error: 'Database query error' }, 500);
      }

      if (!userProfile) {
        return jsonResponse({ error: 'User not found' }, 404);
      }

      // Fetch audit logs safely using service role
      const { data: auditLogs } = await adminClient
        .from('admin_plan_actions')
        .select('id, created_at, action_type, admin_email, target_email, old_plan, new_plan, reason')
        .eq('target_user_id', userProfile.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch usage events safely using service role
      const { data: usageEvents } = await adminClient
        .from('usage_events')
        .select('id, created_at, event_type, value, details')
        .eq('user_id', userProfile.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch family children
      const { data: familyChildrenRaw } = await adminClient
        .from('child_profiles')
        .select('id, status, child_user_id, child_email, display_name, created_at')
        .eq('parent_user_id', userProfile.id)
        .limit(20);

      const childUserIds = familyChildrenRaw?.map(c => c.child_user_id).filter(Boolean) || [];
      let childrenProfiles = [];
      if (childUserIds.length > 0) {
        const { data } = await adminClient.from('profiles').select('id, plan, account_status').in('id', childUserIds);
        if (data) childrenProfiles = data;
      }

      const safeFamilyChildren = familyChildrenRaw?.map(child => {
        const prof = childrenProfiles.find(p => p.id === child.child_user_id);
        return {
          ...child,
          plan: prof?.plan || 'free',
          account_status: prof?.account_status || 'unknown'
        };
      }) || [];

      // Fetch parental consents
      const { data: parentalConsents } = await adminClient
        .from('parental_consents')
        .select('id, consent_status, child_user_id, parent_email, last_email_sent_at, email_send_count, email_last_status, email_last_error, created_at, updated_at')
        .or(`parent_email.eq.${userProfile.email},child_user_id.eq.${userProfile.id}`)
        .limit(20);

      return jsonResponse({
        user: userProfile,
        auditLogs: auditLogs ?? [],
        usageEvents: usageEvents ?? [],
        familyChildren: safeFamilyChildren,
        parentalConsents: parentalConsents ?? []
      });
    }

    // ── 8. Plan management actions (all require userId + optional reason) ───────
    const { userId } = body;
    if (!userId || typeof userId !== 'string') {
      return jsonResponse({ error: 'Missing userId parameter' }, 400);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return jsonResponse({ error: 'Invalid userId format' }, 400);
    }

    const sanitizedReason = sanitizeReason(body.reason);
    if (!sanitizedReason || sanitizedReason.length < 3) {
      return jsonResponse({ error: 'Powód zmiany jest wymagany (min. 3 znaki)' }, 400);
    }

    console.log("Admin plan action requested", { action });

    // ── 9. Fetch state BEFORE the change ──────────────────────────────────────
    const beforeProfile = await fetchUserProfile(userId);
    if (!beforeProfile) {
      return jsonResponse({ error: 'Target user not found' }, 404);
    }

    const oldPlan: string | null = beforeProfile.plan ?? null;
    const oldExpiresAt: string | null = beforeProfile.plan_expires_at ?? null;
    const targetEmail: string = beforeProfile.email ?? '';

    // ── 10. Execute the plan change ────────────────────────────────────────────
    if (action === 'activate_premium_30') {
      const { error } = await adminClient
        .from('profiles')
        .update({
          plan: 'premium',
          plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          plan_updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('[admin-plan-management] activate_premium_30 error:', error.message);
        return jsonResponse({ error: 'Failed to activate plan' }, 500);
      }

      const updatedUser = await fetchUserProfile(userId);

      await writeAuditLog({
        action_type: 'activate_premium_30',
        target_user_id: userId,
        target_email: targetEmail,
        old_plan: oldPlan,
        new_plan: updatedUser?.plan ?? 'premium',
        old_plan_expires_at: oldExpiresAt,
        new_plan_expires_at: updatedUser?.plan_expires_at ?? null,
        reason: sanitizedReason,
      });

      return jsonResponse({ success: true, user: updatedUser });
    }

    if (action === 'extend_premium_30') {
      const { data: rpcData, error: rpcError } = await adminClient
        .rpc('admin_extend_plan_30_days', {
          target_user_id: userId,
          target_plan: 'premium',
        });

      if (rpcError) {
        console.error('[admin-plan-management] extend_premium_30 RPC error:', rpcError.message);
        return jsonResponse({ error: 'Failed to extend plan' }, 500);
      }

      if (!rpcData?.success) {
        return jsonResponse({ error: 'Extension rejected by database function' }, 500);
      }

      const updatedUser = await fetchUserProfile(userId);

      await writeAuditLog({
        action_type: 'extend_premium_30',
        target_user_id: userId,
        target_email: targetEmail,
        old_plan: oldPlan,
        new_plan: updatedUser?.plan ?? 'premium',
        old_plan_expires_at: oldExpiresAt,
        new_plan_expires_at: updatedUser?.plan_expires_at ?? null,
        reason: sanitizedReason,
      });

      return jsonResponse({ success: true, user: updatedUser });
    }

    if (action === 'extend_family_30') {
      const { data: rpcData, error: rpcError } = await adminClient
        .rpc('admin_extend_plan_30_days', {
          target_user_id: userId,
          target_plan: 'family',
        });

      if (rpcError) {
        console.error('[admin-plan-management] extend_family_30 RPC error:', rpcError.message);
        return jsonResponse({ error: 'Failed to extend plan' }, 500);
      }

      if (!rpcData?.success) {
        return jsonResponse({ error: 'Extension rejected by database function' }, 500);
      }

      const updatedUser = await fetchUserProfile(userId);

      await writeAuditLog({
        action_type: 'extend_family_30',
        target_user_id: userId,
        target_email: targetEmail,
        old_plan: oldPlan,
        new_plan: updatedUser?.plan ?? 'family',
        old_plan_expires_at: oldExpiresAt,
        new_plan_expires_at: updatedUser?.plan_expires_at ?? null,
        reason: sanitizedReason,
      });

      return jsonResponse({ success: true, user: updatedUser });
    }

    if (action === 'activate_family_30') {
      const { error } = await adminClient
        .from('profiles')
        .update({
          plan: 'family',
          plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          plan_updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('[admin-plan-management] activate_family_30 error:', error.message);
        return jsonResponse({ error: 'Failed to activate family plan' }, 500);
      }

      const updatedUser = await fetchUserProfile(userId);

      await writeAuditLog({
        action_type: 'activate_family_30',
        target_user_id: userId,
        target_email: targetEmail,
        old_plan: oldPlan,
        new_plan: updatedUser?.plan ?? 'family',
        old_plan_expires_at: oldExpiresAt,
        new_plan_expires_at: updatedUser?.plan_expires_at ?? null,
        reason: sanitizedReason,
      });

      return jsonResponse({ success: true, user: updatedUser });
    }

    if (action === 'set_free') {
      const { error } = await adminClient
        .from('profiles')
        .update({
          plan: 'free',
          plan_expires_at: null,
          plan_updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('[admin-plan-management] set_free error:', error.message);
        return jsonResponse({ error: 'Failed to set free plan' }, 500);
      }

      const updatedUser = await fetchUserProfile(userId);

      await writeAuditLog({
        action_type: 'set_free',
        target_user_id: userId,
        target_email: targetEmail,
        old_plan: oldPlan,
        new_plan: 'free',
        old_plan_expires_at: oldExpiresAt,
        new_plan_expires_at: null,
        reason: sanitizedReason,
      });

      return jsonResponse({ success: true, user: updatedUser });
    }

    if (action === 'resend_parent_consent_email') {
      const { consentId } = body;
      if (!consentId || typeof consentId !== 'string') {
        return jsonResponse({ error: 'Missing consentId parameter' }, 400);
      }

      const { data: consent, error: consentErr } = await adminClient
        .from('parental_consents')
        .select('*')
        .eq('id', consentId)
        .maybeSingle();

      if (consentErr || !consent) {
        return jsonResponse({ error: 'Zgoda nie znaleziona' }, 404);
      }

      if (consent.consent_status !== 'pending') {
        return jsonResponse({ error: `Nie można wysłać ponownie dla statusu: ${consent.consent_status}` }, 400);
      }

      if (consent.last_email_sent_at) {
        const lastSent = new Date(consent.last_email_sent_at).getTime();
        const diffSecs = (Date.now() - lastSent) / 1000;
        if (diffSecs < 900) {
          return jsonResponse({ error: `Musisz odczekać jeszcze ${Math.ceil((900 - diffSecs) / 60)} minut przed kolejną wysyłką.` }, 429);
        }
      }

      const { data: childProfile } = await adminClient
        .from('profiles')
        .select('name')
        .eq('id', consent.child_user_id)
        .single();
      const profileName = childProfile?.name || 'Uczeń';

      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL');
      const appBaseUrl = Deno.env.get('APP_BASE_URL');
      if (!resendApiKey || !resendFromEmail || !appBaseUrl) {
        return jsonResponse({ error: 'Błąd konfiguracji e-mail na serwerze.' }, 500);
      }

      const rawToken = Array.from(crypto.getRandomValues(new Uint8Array(36)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const encoder = new TextEncoder();
      const data = encoder.encode(rawToken);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const newTokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      const { error: updateErr } = await adminClient
        .from('parental_consents')
        .update({
          token_hash: newTokenHash,
          token_expires_at: expiresAt.toISOString(),
          last_email_sent_at: new Date().toISOString(),
          email_send_count: (consent.email_send_count || 0) + 1,
          email_last_status: 'sending',
          updated_at: new Date().toISOString()
        })
        .eq('id', consentId);

      if (updateErr) {
        return jsonResponse({ error: 'Nie udało się zaktualizować zgody' }, 500);
      }

      const consentLink = `${appBaseUrl}/consent/${rawToken}`;

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: resendFromEmail,
          to: consent.parent_email,
          subject: 'Zgoda na korzystanie z OmniNauka przez dziecko',
          html: generateConsentEmailHtml(profileName, consentLink, appBaseUrl),
        }),
      });

      const resendData = await resendRes.json().catch(() => ({}));

      if (!resendRes.ok) {
        await adminClient
          .from('parental_consents')
          .update({
            email_last_status: 'error',
            email_last_error: JSON.stringify({ status: resendRes.status, ...resendData })
          })
          .eq('id', consentId);

        return jsonResponse({ error: 'Błąd dostawcy wysyłki e-mail.' }, 500);
      }

      await adminClient
        .from('parental_consents')
        .update({ email_last_status: 'success' })
        .eq('id', consentId);

      return jsonResponse({ success: true });
    }

    // Unknown action
    return jsonResponse({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin-plan-management] Unhandled error:', message);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
