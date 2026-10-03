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

// Directory reads are called only after JWT verification and ADMIN_EMAILS.
const directoryStatuses = ['active', 'pending_parent_consent', 'parent_approved', 'suspended',
  'parent_withdrawn', 'pending_parent_preapproval', 'expired_pending_preapproval'];
const unknownRoleFilter = 'user_role.is.null,user_role.not.in.(parent,student)';
const profileColumns = 'id,email,name,created_at,user_role,age_band,account_status,plan,plan_expires_at';
type DirectoryProfile = {
  id: string; email: string | null; name: string | null; created_at: string | null;
  user_role: string | null; age_band: string | null; account_status: string | null;
  plan: string | null; plan_expires_at: string | null;
};
type DirectoryParent = Pick<DirectoryProfile, 'id' | 'email' | 'name' | 'user_role' | 'plan' | 'plan_expires_at'>;
type DirectoryRelation = {
  id: string; parent_user_id: string | null; child_user_id: string | null; status: string;
  preapproval_integrity_version: number | null; guardian_consent_acknowledged_at: string | null;
  guardian_consent_version: string | null;
};

function directoryInput(body: Record<string, unknown>) {
  const page = body.page === undefined ? 1 : body.page;
  const pageSize = body.pageSize === undefined ? 25 : body.pageSize;
  const search = body.search === undefined ? '' : body.search;
  const typeFilter = body.typeFilter === undefined ? 'all' : body.typeFilter;
  const ownPlanFilter = body.ownPlanFilter === undefined ? 'all' : body.ownPlanFilter;
  const statusFilter = body.statusFilter === undefined ? 'all' : body.statusFilter;
  if (typeof page !== 'number' || !Number.isSafeInteger(page) || page < 1
    || typeof pageSize !== 'number' || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50
    || !Number.isSafeInteger(page * pageSize)
    || typeof search !== 'string' || search.trim().length > 100
    || typeof typeFilter !== 'string' || !['all', 'parent', 'child_under_13', 'student', 'unknown'].includes(typeFilter)
    || typeof ownPlanFilter !== 'string' || !['all', 'free', 'premium', 'family'].includes(ownPlanFilter)
    || typeof statusFilter !== 'string' || !['all', ...directoryStatuses].includes(statusFilter)) return null;
  return { page, pageSize, search: search.trim().replace(/[%_*]/g, ''), typeFilter, ownPlanFilter, statusFilter };
}

function trustedDirectoryRelation(relation: DirectoryRelation, parents: Map<string, DirectoryParent>) {
  return relation.child_user_id !== null && relation.parent_user_id !== null
    && relation.child_user_id !== relation.parent_user_id
    && ['linked', 'active'].includes(relation.status)
    && relation.preapproval_integrity_version === 1
    && parents.get(relation.parent_user_id)?.user_role === 'parent';
}

function directoryUser(profile: DirectoryProfile, relations: DirectoryRelation[], parents: Map<string, DirectoryParent>, now: number) {
  const businessType = profile.user_role === 'parent' ? 'parent'
    : profile.user_role === 'student' ? (profile.age_band === 'under_13' ? 'child_under_13' : 'student') : 'unknown';
  const childRelations = relations.filter(relation => relation.child_user_id === profile.id && trustedDirectoryRelation(relation, parents));
  const displayedParent = childRelations.length ? parents.get(childRelations[0].parent_user_id!) : null;
  const validExpiry = (expiry: string | null) => expiry === null || Date.parse(expiry) > now;
  let effectivePlan = 'free';
  let planSource = 'own';
  let sourcePlanExpiresAt = profile.plan_expires_at;
  if (['premium', 'family'].includes(profile.plan ?? '') && validExpiry(profile.plan_expires_at)) {
    effectivePlan = profile.plan!;
  } else {
    const familyRelation = childRelations.find(relation => {
      const parent = parents.get(relation.parent_user_id!)!;
      return relation.guardian_consent_acknowledged_at !== null
        && relation.guardian_consent_version === 'child_email_preapproval_v1'
        && parent.plan === 'family' && validExpiry(parent.plan_expires_at);
    });
    if (familyRelation) {
      effectivePlan = 'family';
      planSource = 'parent_family';
      sourcePlanExpiresAt = parents.get(familyRelation.parent_user_id!)!.plan_expires_at;
    }
  }
  return {
    userId: profile.id, email: profile.email, name: profile.name, createdAt: profile.created_at,
    businessType, rawUserRole: profile.user_role, ageBand: profile.age_band, accountStatus: profile.account_status,
    ownPlan: profile.plan, effectivePlan, planSource, planExpiresAt: profile.plan_expires_at, sourcePlanExpiresAt,
    parent: displayedParent ? { userId: displayedParent.id, name: displayedParent.name, email: displayedParent.email } : null,
    linkedChildrenCount: businessType === 'parent' ? relations.filter(relation => relation.parent_user_id === profile.id && trustedDirectoryRelation(relation, parents)).length : 0,
    pendingChildrenCount: businessType === 'parent' ? relations.filter(relation => relation.parent_user_id === profile.id && relation.status === 'pending_child_registration' && relation.preapproval_integrity_version === 1).length : 0,
    relationStatus: childRelations[0]?.status ?? null,
  };
}

async function listDirectory(client: ReturnType<typeof createClient>, input: NonNullable<ReturnType<typeof directoryInput>>) {
  let query = client.from('profiles').select(profileColumns, { count: 'exact' });
  if (input.search) {
    // PostgREST quoted values: commas/parentheses remain data, never operators.
    const pattern = `"%${input.search.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}%"`;
    query = query.or(`email.ilike.${pattern},name.ilike.${pattern}`);
  }
  if (input.typeFilter === 'parent') query = query.eq('user_role', 'parent');
  if (input.typeFilter === 'child_under_13') query = query.eq('user_role', 'student').eq('age_band', 'under_13');
  // NULL age is still a student; NULL role never enters this branch.
  if (input.typeFilter === 'student') query = query.eq('user_role', 'student').or('age_band.neq.under_13,age_band.is.null');
  if (input.typeFilter === 'unknown') query = query.or(unknownRoleFilter);
  if (input.ownPlanFilter !== 'all') query = query.eq('plan', input.ownPlanFilter);
  if (input.statusFilter !== 'all') query = query.eq('account_status', input.statusFilter);
  const from = (input.page - 1) * input.pageSize;
  const [pageResult, totalResult, parentResult, childResult, unknownResult] = await Promise.all([
    query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + input.pageSize - 1),
    client.from('profiles').select('id', { count: 'exact', head: true }),
    client.from('profiles').select('id', { count: 'exact', head: true }).eq('user_role', 'parent'),
    client.from('profiles').select('id', { count: 'exact', head: true }).eq('user_role', 'student').eq('age_band', 'under_13'),
    client.from('profiles').select('id', { count: 'exact', head: true }).or(unknownRoleFilter),
  ]);
  for (const result of [pageResult, totalResult, parentResult, childResult, unknownResult]) {
    if (result.error || result.count === null) throw new Error('Directory query failed');
  }
  const profiles: DirectoryProfile[] = pageResult.data ?? [];
  const ids = profiles.map(profile => profile.id);
  let relations: DirectoryRelation[] = [];
  const parents = new Map<string, DirectoryParent>();
  if (ids.length) {
    // IDs come from DB profiles, not request expressions. Reject schema anomalies.
    if (ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) throw new Error('Invalid directory IDs');
    const relationResult = await client.from('child_profiles')
      .select('id,parent_user_id,child_user_id,status,preapproval_integrity_version,guardian_consent_acknowledged_at,guardian_consent_version', { count: 'exact' })
      .or(`parent_user_id.in.(${ids.join(',')}),child_user_id.in.(${ids.join(',')})`);
    if (relationResult.error || relationResult.count !== relationResult.data?.length) throw new Error('Incomplete relations');
    relations = relationResult.data ?? [];
    const parentIds = [...new Set(relations.map(relation => relation.parent_user_id).filter((id): id is string => id !== null))];
    if (parentIds.length) {
      const result = await client.from('profiles').select('id,name,email,user_role,plan,plan_expires_at').in('id', parentIds);
      if (result.error) throw new Error('Parent query failed');
      for (const parent of result.data ?? []) parents.set(parent.id, parent);
    }
  }
  const now = Date.now();
  return {
    users: profiles.map(profile => directoryUser(profile, relations, parents, now)),
    pagination: { page: input.page, pageSize: input.pageSize, total: pageResult.count!, totalPages: Math.ceil(pageResult.count! / input.pageSize) },
    summary: { totalProfiles: totalResult.count!, parents: parentResult.count!, childrenUnder13: childResult.count!, unknownRoleProfiles: unknownResult.count! },
  };
}

async function listAccountIssues(client: ReturnType<typeof createClient>) {
  const unknown = await client.from('profiles').select('id,email,name,created_at,user_role', { count: 'exact' }).or(unknownRoleFilter)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1000);
  if (unknown.error || unknown.count === null) throw new Error('Issue query failed');
  let scanTruncated = unknown.count > (unknown.data?.length ?? 0);
  const authUsers: { id: string; email?: string; created_at: string; last_sign_in_at?: string }[] = [];
  // At most 4 Auth pages / 1000 users. A full final page is conservatively incomplete.
  for (let page = 1; page <= 4; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 250 });
    if (error) throw new Error('Auth scan failed');
    authUsers.push(...data.users.slice(0, 250));
    if (data.users.length < 250) break;
    if (page === 4) scanTruncated = true;
  }
  const profileIds = new Set<string>();
  // Fixed maximum of five batches; avoid an oversized URI and never use in([]).
  for (let offset = 0; offset < authUsers.length; offset += 200) {
    const ids = authUsers.slice(offset, offset + 200).map(user => user.id);
    const result = await client.from('profiles').select('id', { count: 'exact' }).in('id', ids);
    if (result.error || result.count !== result.data?.length) throw new Error('Profile comparison failed');
    for (const profile of result.data ?? []) profileIds.add(profile.id);
  }
  const missing = authUsers.filter(user => !profileIds.has(user.id)).map(user => ({
    issueType: 'missing_profile', userId: user.id, email: user.email ?? null,
    createdAt: user.created_at, lastSignInAt: user.last_sign_in_at ?? null,
  }));
  const unknownIssues = (unknown.data ?? []).map(profile => ({
    issueType: 'unknown_role', userId: profile.id, email: profile.email, name: profile.name, createdAt: profile.created_at,
  }));
  return { issues: [...missing, ...unknownIssues], summary: {
    missingProfiles: missing.length, unknownRoleProfiles: unknownIssues.length, totalIssues: missing.length + unknownIssues.length,
  }, scanTruncated };
}

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

    if (action === 'list_users' || action === 'list_account_issues') {
      try {
        if (action === 'list_account_issues') return jsonResponse(await listAccountIssues(adminClient));
        const input = directoryInput(body);
        if (!input) return jsonResponse({ error: 'Nieprawidłowe kryteria wyszukiwania.' }, 400);
        return jsonResponse(await listDirectory(adminClient, input));
      } catch {
        console.error('[admin-plan-management] Directory read failed');
        return jsonResponse({ error: 'Nie udało się pobrać listy użytkowników.' }, 503);
      }
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
