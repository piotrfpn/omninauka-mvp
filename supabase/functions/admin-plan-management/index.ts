import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    // ── 3. Check ADMIN_EMAILS allowlist ────────────────────────────────────────
    const adminEmailsEnv = Deno.env.get('ADMIN_EMAILS') ?? '';
    if (!adminEmailsEnv) {
      console.error('[admin-plan-management] ADMIN_EMAILS secret not configured');
      return jsonResponse({ error: 'Admin access not configured' }, 500);
    }

    const adminEmails = adminEmailsEnv
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    if (!adminEmails.includes(requestingEmail)) {
      return jsonResponse({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    // ── 4. Admin is verified — use service client for all operations ───────────
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // ── 5. Parse request body ──────────────────────────────────────────────────
    const body = await req.json();
    const { action } = body;

    if (!action || typeof action !== 'string') {
      return jsonResponse({ error: 'Missing or invalid action' }, 400);
    }

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
      const rawEmail = body.email;
      if (!rawEmail || typeof rawEmail !== 'string') {
        return jsonResponse({ error: 'Missing email parameter' }, 400);
      }

      const normalizedEmail = rawEmail.trim().toLowerCase();
      if (!normalizedEmail.includes('@')) {
        return jsonResponse({ error: 'Invalid email format' }, 400);
      }

      const { data: userProfile, error: userError } = await adminClient
        .from('profiles')
        .select('id, email, plan, plan_expires_at, plan_updated_at, created_at')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (userError) {
        console.error('[admin-plan-management] search_user error:', userError.message);
        return jsonResponse({ error: 'Database query error' }, 500);
      }

      if (!userProfile) {
        return jsonResponse({ user: null });
      }

      // Fetch audit logs safely using service role
      const { data: auditLogs } = await adminClient
        .from('admin_plan_actions')
        .select('id, created_at, action_type, admin_email, target_email, old_plan, new_plan, reason')
        .eq('target_user_id', userProfile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch usage events safely using service role
      const { data: usageEvents } = await adminClient
        .from('usage_events')
        .select('id, created_at, event_type, value, details')
        .eq('user_id', userProfile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch family children
      const { data: familyChildrenRaw } = await adminClient
        .from('child_profiles')
        .select('id, status, child_user_id, child_email, display_name, created_at')
        .eq('parent_user_id', userProfile.id)
        .limit(10);

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
        .or(`parent_email.eq.${normalizedEmail},child_user_id.eq.${userProfile.id}`)
        .limit(10);

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

    // Unknown action
    return jsonResponse({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin-plan-management] Unhandled error:', message);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
