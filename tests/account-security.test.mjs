import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { getAiAccountDenial } from '../supabase/functions/_shared/account-access.ts';
import { createConsentApprovalHandler } from '../supabase/functions/_shared/consent-approval.ts';

const userId = '11111111-1111-4111-8111-111111111111';
const rawToken = '12'.repeat(36);
const storedHash = createHash('sha256').update(rawToken).digest('hex');

function checkAccount(client) {
  return getAiAccountDenial(
    client.from('profiles').select('account_status').eq('id', userId).maybeSingle(), {},
  );
}

function profileClient(data, error = null, fail = false) {
  return {
    from(table) {
      assert.equal(table, 'profiles');
      return { select(columns) {
        assert.equal(columns, 'account_status');
        return { eq(column, value) {
          assert.equal(column, 'id');
          assert.equal(value, userId);
          return { async maybeSingle() {
            if (fail) throw new Error('Profile transport failed');
            return { data, error };
          } };
        } };
      } };
    },
  };
}

for (const status of ['active', 'parent_approved']) {
  test(`AI permits database status ${status}`, async () => {
    assert.equal(await checkAccount(profileClient({ account_status: status })), null);
  });
}

const blocked = [
  'pending_parent_consent', 'pending_parent_preapproval', 'expired_pending_preapproval',
  'suspended', 'parent_withdrawn', 'withdrawn', 'blocked', 'deleted', 'under_13',
  'unknown', '', null, undefined,
];

for (const status of blocked) {
  test(`AI rejects database status ${String(status)}`, async () => {
    const response = await checkAccount(profileClient({ account_status: status }));
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'account_access_denied' });
  });
}

for (const [label, client] of [
  ['missing profile', profileClient(null)],
  ['query error despite active data', profileClient({ account_status: 'active' }, { code: 'error' })],
  ['transport exception', profileClient(null, null, true)],
]) {
  test(`AI fails closed: ${label}`, async () => {
    assert.equal((await checkAccount(client)).status, 403);
  });
}

// Execute the actual Edge entrypoints with Auth, database and provider doubles.
// Denial must return BEFORE any provider fetch, even with forged body metadata.
async function loadEndpoint(name, client, fetchProvider, overrideClient) {
  const source = await readFile(new URL(`../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8');
  const body = source.replace(/^import .*;\r?\n/gm, '');
  const js = ts.transpileModule(body, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  let handler;
  const createClient = () => ({
    ...client,
    auth: { async getUser() { return { data: { user: { id: userId } }, error: null }; } },
  });
  const boot = new Function('serve', 'createClient', 'getAiAccountDenial',
    'createConsentApprovalHandler', 'Deno', 'fetch', 'console', js);
  boot(fn => { handler = fn; }, overrideClient ?? createClient, getAiAccountDenial, createConsentApprovalHandler,
    { env: { get: () => 'test-only-configuration' } }, fetchProvider,
    { log() {}, warn() {}, error() {}, info() {} });
  assert.equal(typeof handler, 'function');
  return handler;
}

for (const name of ['analyze-notes', 'chat-tutor', 'regenerate-module']) {
  for (const [label, client] of [
    ...blocked.map(status => [String(status), profileClient({ account_status: status })]),
    ['missing profile', profileClient(null)],
    ['database error', profileClient({ account_status: 'active' }, { code: 'error' })],
    ['transport error', profileClient(null, null, true)],
  ]) {
    test(`${name}: ${label} never calls provider`, async () => {
      let providerCalls = 0;
      const handler = await loadEndpoint(name, client, async () => { providerCalls++; throw new Error('Provider reached'); });
      const response = await handler(new Request('https://example.invalid/ai', {
        method: 'POST', headers: { Authorization: 'Bearer test-user', 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: userId, module: 'quiz', account_status: 'active', accountStatus: 'active' }),
      }));
      assert.equal(response.status, 403);
      assert.equal(providerCalls, 0);
    });
  }
}

function consentRequest(body, headers = {}) {
  return new Request('https://example.invalid/consent', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('Public approval entrypoint uses its backend service client, not caller Authorization', async () => {
  let parameters;
  let clientCalls = 0;
  const handler = await loadEndpoint('approve-parental-consent', null,
    async () => { throw new Error('Unexpected provider call'); }, (url, key, options) => {
      clientCalls++;
      assert.equal(url, 'test-only-configuration');
      assert.equal(key, 'test-only-configuration');
      assert.deepEqual(options, { auth: { persistSession: false, autoRefreshToken: false } });
      return { async rpc(name, value) {
        assert.equal(name, 'approve_parental_consent');
        parameters = value;
        return { data: true, error: null };
      } };
    });
  const response = await handler(consentRequest({ token: rawToken }, { Authorization: 'Bearer child-token' }));
  assert.equal(response.status, 200);
  assert.equal(clientCalls, 1);
  assert.equal(parameters.p_token_hash, storedHash);
  assert.deepEqual(await response.json(), { status: 'approved' });
});

test('Approval hashes raw token server-side, ignores body hash/IP/agent and returns minimal payload', async () => {
  let parameters;
  const handler = createConsentApprovalHandler(async value => { parameters = value; return true; });
  const response = await handler(consentRequest({ token: rawToken, token_hash: 'forged', p_ip: 'forged', p_user_agent: 'forged' }, {
    'user-agent': 'request-agent', 'x-forwarded-for': 'forged-forwarded-ip',
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(parameters, { p_token_hash: storedHash, p_ip: null, p_user_agent: 'request-agent' });
  assert.deepEqual(await response.json(), { status: 'approved' });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('Knowing the stored hash does not supply the raw bearer secret', async () => {
  const handler = createConsentApprovalHandler(async value => value.p_token_hash === storedHash);
  assert.equal((await handler(consentRequest({ token: storedHash }))).status, 409);
  assert.equal((await handler(consentRequest({ token: rawToken }))).status, 200);
});

test('Previous 32-byte raw token format remains supported', async () => {
  const token = 'ab'.repeat(32);
  const handler = createConsentApprovalHandler(async value =>
    value.p_token_hash === createHash('sha256').update(token).digest('hex'));
  assert.equal((await handler(consentRequest({ token }))).status, 200);
});

test('Backend false (expired/consumed/ineligible) is denied without disclosure', async () => {
  const handler = createConsentApprovalHandler(async () => false);
  const response = await handler(consentRequest({ token: rawToken }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { status: 'invalid' });
});

test('Database errors remain private', async () => {
  const handler = createConsentApprovalHandler(async () => { throw new Error('private-parent-email and secret-hash'); });
  const response = await handler(consentRequest({ token: rawToken }));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { status: 'unavailable' });
});

for (const body of [{}, { token_hash: storedHash }, { token: null }, { token: 123 },
  { token: {} }, { token: 'junk' }, { token: rawToken + '00' }]) {
  test(`Invalid approval input ${JSON.stringify(body)} never reaches database`, async () => {
    let calls = 0;
    const handler = createConsentApprovalHandler(async () => { calls++; return true; });
    assert.equal((await handler(consentRequest(body))).status, 400);
    assert.equal(calls, 0);
  });
}

test('Method, JSON and streaming body limits reject before database', async () => {
  let calls = 0;
  const handler = createConsentApprovalHandler(async () => { calls++; return true; });
  assert.equal((await handler(new Request('https://example.invalid', { method: 'GET' }))).status, 405);
  assert.equal((await handler(new Request('https://example.invalid', { method: 'OPTIONS' }))).status, 200);
  assert.equal((await handler(new Request('https://example.invalid', { method: 'POST', body: '{' }))).status, 400);
  assert.equal((await handler(consentRequest({ token: rawToken, padding: 'x'.repeat(2048) }))).status, 413);
  assert.equal(calls, 0);
});

// 29D.1B: static SQL contract checks only. These do NOT execute PostgreSQL,
// RLS, triggers, FK actions or concurrent transactions. LIVE_DB_TEST_REQUIRED=YES.
const childMigrationUrl = new URL('../supabase/migrations/00076_child_profiles_authorization_hardening.sql', import.meta.url);
const childMigration = (await readFile(childMigrationUrl, 'utf8')).replace(/\r\n/g, '\n');

function childSqlSection(start, end) {
  const from = childMigration.indexOf(start);
  assert.ok(from >= 0, `Missing SQL section: ${start}`);
  const to = childMigration.indexOf(end, from + start.length);
  assert.ok(to > from, `Missing SQL section ending: ${end}`);
  return childMigration.slice(from, to + end.length);
}

const legacySql = childSqlSection('DO $legacy$', '$legacy$;');
const aclSql = childSqlSection('DO $acl$', '$acl$;');
const semanticSql = childSqlSection('CREATE OR REPLACE FUNCTION public.protect_child_profile_authorization()', '$guard$;');
const insertSql = childSqlSection("  IF TG_OP = 'INSERT' THEN", "  -- Current UI only archives");
const linkSql = childSqlSection('CREATE OR REPLACE FUNCTION public.link_child_account()', '$link$;');
const planSql = childSqlSection('CREATE OR REPLACE FUNCTION public.get_my_effective_plan()', '$plan$;');
const parentSql = childSqlSection('CREATE OR REPLACE FUNCTION public.get_parent_children()', '$dashboard$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;');
const cleanupSql = childSqlSection('CREATE OR REPLACE VIEW public.v_under13_pending_cleanup_candidates', 'GRANT SELECT ON public.v_under13_pending_cleanup_candidates TO service_role;');
const childPolicies = [...childMigration.matchAll(/CREATE POLICY "([^"]+)"\s+ON public\.child_profiles[\s\S]*?;/g)].map(match => match[0]);

test('29D child migration exists, wraps all changes in one transaction and pairs dollar quotes', () => {
  assert.match(childMigration, /\nBEGIN;\s/);
  assert.match(childMigration, /\nCOMMIT;\s*$/);
  for (const tag of ['legacy', 'acl', 'guard', 'link', 'plan', 'dashboard']) {
    assert.equal(childMigration.split(`$${tag}$`).length - 1, 2, `Unpaired ${tag} quote`);
  }
});

test('29D removes every existing child policy, including drifted permissive names', () => {
  assert.match(aclSql, /SELECT policyname FROM pg_policies\s+WHERE schemaname = 'public' AND tablename = 'child_profiles'/);
  assert.match(aclSql, /FOR v_policy IN[\s\S]*LOOP[\s\S]*EXECUTE format\('DROP POLICY %I ON public\.child_profiles', v_policy\.policyname\)/);
  assert.ok(childMigration.indexOf('$acl$;') < childMigration.indexOf('CREATE POLICY'));
  assert.equal(childPolicies.length, 3);
  for (const policy of childPolicies) assert.match(policy, /TO authenticated\b/);
  assert.doesNotMatch(childPolicies.join('\n'), /TO PUBLIC|FOR ALL|FOR DELETE/);
});

test('29D anon and PUBLIC lose table and all-column privileges; no client DELETE is regranted', () => {
  assert.match(childMigration, /REVOKE ALL PRIVILEGES ON TABLE public\.child_profiles FROM PUBLIC, anon, authenticated;/);
  assert.match(aclSql, /REVOKE ALL PRIVILEGES \(%s\) ON TABLE public\.child_profiles FROM PUBLIC, anon, authenticated/);
  assert.match(aclSql, /string_agg\(format\('%I', attname\)/);
  assert.match(aclSql, /attnum > 0 AND NOT attisdropped/);
  const grants = [...childMigration.matchAll(/GRANT [^;]+ ON TABLE public\.child_profiles TO [^;]+;/g)].map(match => match[0]);
  assert.deepEqual(grants, [
    'GRANT SELECT, INSERT, UPDATE ON TABLE public.child_profiles TO authenticated;',
    'GRANT ALL PRIVILEGES ON TABLE public.child_profiles TO service_role;',
  ]);
});

test('29D student INSERT is denied by both RLS and invoker trigger role contracts', () => {
  for (const policy of childPolicies) {
    assert.match(policy, /parent_user_id = auth\.uid\(\)/);
    assert.match(policy, /p\.id = auth\.uid\(\) AND p\.user_role = 'parent'/);
  }
  assert.match(semanticSql, /OR NOT EXISTS \(\s+SELECT 1 FROM public\.profiles p WHERE p\.id = auth\.uid\(\) AND p\.user_role = 'parent'\s+\) THEN\s+RAISE EXCEPTION/);
});

test('29D UPDATE has explicit old/new owner and parent-role policy checks', () => {
  const policy = childPolicies.find(value => value.includes('FOR UPDATE'));
  assert.match(policy, /USING \([\s\S]*WITH CHECK \(/);
  assert.equal(policy.split('parent_user_id = auth.uid()').length - 1, 2);
  assert.equal(policy.split("p.user_role = 'parent'").length - 1, 2);
  assert.match(semanticSql, /NEW\.parent_user_id IS DISTINCT FROM auth\.uid\(\)/);
  assert.match(semanticSql, /OLD\.parent_user_id IS DISTINCT FROM auth\.uid\(\)/);
});

test('29D legal parent pending INSERT remains compatible with the existing dashboard declaration', async () => {
  const dashboard = await readFile(new URL('../src/pages/app/ParentDashboardPage.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /status: 'pending_child_registration'/);
  assert.match(dashboard, /guardian_consent_acknowledged_at: new Date\(\)\.toISOString\(\)/);
  assert.match(insertSql, /NEW\.guardian_consent_acknowledged_at IS NULL THEN\s+RAISE EXCEPTION/);
  assert.match(insertSql, /NEW\.updated_at := now\(\);\s+RETURN NEW;/);
});

test('29D client INSERT cannot bind a child or create linked/active authorization state', () => {
  assert.match(insertSql, /IF NEW\.child_user_id IS NOT NULL\s+OR NEW\.status IS DISTINCT FROM 'pending_child_registration'/);
  assert.match(insertSql, /NEW\.age_band IS NULL OR NEW\.age_band NOT IN \('7_9', '10_12'\)/);
  assert.match(insertSql, /NEW\.child_email IS NULL OR btrim\(NEW\.child_email\) = ''/);
  assert.match(insertSql, /RAISE EXCEPTION 'Invalid child preapproval' USING ERRCODE = '42501'/);
});

test('29D DB overwrites normalized email, declaration timestamp/version and integrity marker', () => {
  for (const assignment of [
    'NEW.child_email_normalized := lower(btrim(NEW.child_email));',
    'NEW.guardian_consent_acknowledged_at := now();',
    "NEW.guardian_consent_version := 'child_email_preapproval_v1';",
    'NEW.preapproval_integrity_version := 1;',
    'NEW.created_at := now();',
    'NEW.updated_at := now();',
  ]) assert.ok(insertSql.includes(assignment), assignment);
  assert.match(childMigration, /preapproval_integrity_version integer NOT NULL DEFAULT 0/);
  assert.match(childMigration, /CHECK \(preapproval_integrity_version IN \(0, 1\)\)/);
});

test('29D client UPDATE protects child ID, identity, consent, integrity and all metadata via whole-row equality', () => {
  const comparisons = [...semanticSql.matchAll(/to_jsonb\((NEW|OLD)\) - ARRAY\[([^\]]+)\]/g)];
  assert.deepEqual(comparisons.map(match => [match[1], match[2]]), [
    ['NEW', "'status', 'updated_at'"], ['OLD', "'status', 'updated_at'"],
  ]);
  assert.match(semanticSql, /\(to_jsonb\(NEW\)[\s\S]*IS DISTINCT FROM[\s\S]*\(to_jsonb\(OLD\)[\s\S]*THEN\s+RAISE EXCEPTION 'Child profile fields are immutable'/);
});

test('29D pending without child can archive; linked/active insertion and archived reactivation cannot pass UPDATE contract', () => {
  assert.match(semanticSql, /IF OLD\.status IS DISTINCT FROM 'pending_child_registration'\s+OR OLD\.child_user_id IS NOT NULL\s+OR OLD\.preapproval_integrity_version IS DISTINCT FROM 1\s+OR NEW\.status IS DISTINCT FROM 'archived' THEN\s+RAISE EXCEPTION/);
});

test('29D invoker trigger uses effective SQL role, with a pinned legal linker owner and no client JWT/GUC bypass', () => {
  assert.match(semanticSql, /SECURITY INVOKER\s+SET search_path = public/);
  assert.match(semanticSql, /IF current_user IN \('postgres', 'service_role'\) THEN\s+RETURN NEW;/);
  assert.match(semanticSql, /IF current_user <> 'authenticated' OR auth\.uid\(\) IS NULL/);
  assert.doesNotMatch(semanticSql, /auth\.jwt\(|current_setting\(|set_config\(|pg_trigger_depth\(/);
  assert.match(childMigration, /ALTER FUNCTION public\.link_child_account\(\) OWNER TO postgres;/);
  assert.match(childMigration, /BEFORE INSERT OR UPDATE ON public\.child_profiles/);
  assert.doesNotMatch(childMigration, /CHECK\s*\([^;]*child_user_id IS NOT NULL/);
});

test('29D both linker lookup branches require trusted integrity, parent role and declaration', () => {
  const branches = [...linkSql.matchAll(/SELECT cp\.id INTO v_matched_id[\s\S]*?FOR UPDATE OF cp;/g)].map(match => match[0]);
  assert.equal(branches.length, 2);
  for (const branch of branches) {
    assert.match(branch, /JOIN public\.profiles parent ON parent\.id = cp\.parent_user_id/);
    assert.match(branch, /cp\.preapproval_integrity_version = 1/);
    assert.match(branch, /parent\.user_role = 'parent'/);
    assert.match(branch, /cp\.parent_user_id <> v_user_id/);
    assert.match(branch, /cp\.guardian_consent_acknowledged_at IS NOT NULL/);
    assert.match(branch, /cp\.guardian_consent_version = 'child_email_preapproval_v1'/);
  }
  assert.match(branches[0], /cp\.child_user_id = v_user_id AND cp\.status IN \('linked', 'active'\)/);
  assert.match(branches[1], /cp\.child_email_normalized = lower\(btrim\(v_user_email\)\)/);
  assert.match(branches[1], /cp\.status = 'pending_child_registration' AND cp\.child_user_id IS NULL/);
});

test('29D linker uses caller identity, preserves fail-closed account states and validates student under_13', () => {
  assert.match(linkSql, /v_user_id uuid := auth\.uid\(\)/);
  assert.match(linkSql, /v_user_email text := auth\.jwt\(\)->>'email'/);
  assert.match(linkSql, /FROM public\.profiles p WHERE p\.id = v_user_id FOR UPDATE/);
  assert.match(linkSql, /v_age_band IS DISTINCT FROM 'under_13'/);
  assert.match(linkSql, /v_child_role IS DISTINCT FROM 'student'/);
  assert.match(linkSql, /v_status IS NULL OR v_status NOT IN \('pending_parent_preapproval', 'active'\)/);
  assert.doesNotMatch(linkSql, /p_user_id|p_child_user_id/);
});

test('29D server linker binds child and linked status with guarded UPDATE, and rolls back failed activation', () => {
  assert.match(linkSql, /UPDATE public\.child_profiles cp\s+SET child_user_id = v_user_id, status = 'linked', updated_at = now\(\)/);
  const update = linkSql.slice(linkSql.indexOf('UPDATE public.child_profiles cp'));
  assert.match(update, /cp\.child_user_id IS NULL/);
  assert.match(update, /cp\.preapproval_integrity_version = 1/);
  assert.match(update, /parent\.user_role = 'parent'/);
  const activations = [...linkSql.matchAll(/UPDATE public\.profiles SET account_status = 'active'[\s\S]*?IF NOT FOUND THEN RAISE EXCEPTION 'Child account transition rejected'; END IF;/g)];
  assert.equal(activations.length, 2);
  for (const [activation] of activations) {
    assert.match(activation, /id = v_user_id AND age_band = 'under_13' AND user_role = 'student'/);
    assert.match(activation, /account_status = 'pending_parent_preapproval'/);
  }
  assert.doesNotMatch(linkSql, /EXCEPTION\s+WHEN|\bCOMMIT\b/);
  assert.match(linkSql, /'reason', 'already_linked'/);
  assert.match(linkSql, /'reason', 'linked_now'/);
});

test('29D Family inheritance requires a trusted real parent relation and keeps existing expiry semantics', () => {
  const inheritance = planSql.slice(planSql.indexOf('SELECT p.plan, p.plan_expires_at'));
  for (const predicate of [
    'cp.child_user_id = v_user_id', "cp.status IN ('linked', 'active')",
    'cp.preapproval_integrity_version = 1', "p.user_role = 'parent'",
    "p.plan = 'family'", '(p.plan_expires_at IS NULL OR p.plan_expires_at > v_now)',
  ]) assert.ok(inheritance.includes(predicate), predicate);
});

test('29D own premium/family behavior and all effective-plan JSON payloads remain unchanged', async () => {
  const old = await readFile(new URL('../supabase/migrations/00067_family_effective_plan_hotfix.sql', import.meta.url), 'utf8');
  const ownBranch = value => value.slice(value.indexOf("  IF v_own_plan IN ('premium', 'family')"), value.indexOf('  END IF;', value.indexOf("  IF v_own_plan IN ('premium', 'family')")) + 9).replace(/\s+/g, ' ');
  assert.equal(ownBranch(planSql), ownBranch(old));
  const objects = value => [...value.matchAll(/RETURN jsonb_build_object\([\s\S]*?\);/g)].map(match => match[0].replace(/\s+/g, ' '));
  assert.deepEqual(objects(planSql), objects(old.slice(0, old.indexOf('-- 2. Refined Child Limit Trigger'))));
});

test('29D grandfathering validates every row under lock before any trusted marker backfill', () => {
  assert.ok(childMigration.indexOf('LOCK TABLE public.child_profiles IN ACCESS EXCLUSIVE MODE;') < childMigration.indexOf('DO $legacy$'));
  assert.match(legacySql, /IF EXISTS \([\s\S]*RAISE EXCEPTION 'Existing child preapprovals failed security validation'/);
  assert.ok(childMigration.indexOf('$legacy$;') < childMigration.indexOf('UPDATE public.child_profiles SET preapproval_integrity_version = 1;'));
  assert.doesNotMatch(legacySql, /count\(\*\)\s*=\s*4|LIMIT 4|EXCEPTION\s+WHEN/);
});

for (const [label, predicate] of [
  ['missing/nonparent owner', "parent.id IS NULL\n      OR parent.user_role IS DISTINCT FROM 'parent'"],
  ['self-link', 'cp.child_user_id = cp.parent_user_id'],
  ['invalid status', "cp.status NOT IN ('pending_child_registration', 'linked', 'active', 'archived')"],
  ['invalid age', "cp.age_band IS NULL OR cp.age_band NOT IN ('7_9', '10_12')"],
  ['missing acknowledgement', "cp.status <> 'archived' AND cp.guardian_consent_acknowledged_at IS NULL"],
  ['future acknowledgement', 'cp.guardian_consent_acknowledged_at > now()'],
  ['wrong consent version', "cp.guardian_consent_version IS DISTINCT FROM 'child_email_preapproval_v1'"],
  ['inconsistent normalized email', 'cp.child_email_normalized IS DISTINCT FROM lower(btrim(cp.child_email))'],
  ['pending with child', "cp.status = 'pending_child_registration' AND cp.child_user_id IS NOT NULL"],
  ['missing linked child/Auth', 'cp.child_user_id IS NULL OR child.id IS NULL OR au.id IS NULL'],
  ['linked child not student', "child.user_role IS DISTINCT FROM 'student'"],
  ['linked child not under_13', "child.age_band IS DISTINCT FROM 'under_13'"],
  ['linked email mismatches Auth', 'cp.child_email_normalized IS DISTINCT FROM lower(btrim(au.email))'],
]) {
  test(`29D legacy fail-closed contract rejects ${label}`, () => {
    assert.ok(legacySql.includes(predicate), predicate);
  });
}

test('29D legacy duplicate live links and over-limit parent groups abort grandfathering', () => {
  assert.match(legacySql, /GROUP BY child_user_id HAVING count\(\*\) > 1/);
  assert.match(legacySql, /GROUP BY parent_user_id HAVING count\(\*\) > 3/);
});

test('29D parent dashboard keeps its payload, requires parent role and filters trusted local relations', async () => {
  const old = (await readFile(new URL('../supabase/migrations/00016_child_profiles_email_preapproval.sql', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const payload = value => value.match(/RETURNS TABLE \([\s\S]*?\) AS/)[0];
  assert.equal(payload(parentSql), payload(old));
  assert.match(parentSql, /IF v_parent_id IS NULL OR NOT EXISTS \([\s\S]*caller\.id = v_parent_id AND caller\.user_role = 'parent'[\s\S]*THEN\s+RETURN;/);
  assert.match(parentSql, /WHERE cp\.parent_user_id = v_parent_id\s+AND cp\.preapproval_integrity_version = 1/);
  const consentBranch = value => value.slice(value.indexOf('    -- Part 1:'), value.indexOf('    UNION ALL'));
  assert.equal(consentBranch(parentSql), consentBranch(old));
});

test('29D cleanup eligibility only trusts verified links and retains its service-only payload', () => {
  assert.match(cleanupSql, /AND NOT EXISTS \([\s\S]*cp\.preapproval_integrity_version = 1/);
  assert.match(cleanupSql, /parent\.user_role = 'parent'/);
  assert.match(cleanupSql, /REVOKE ALL PRIVILEGES ON public\.v_under13_pending_cleanup_candidates FROM PUBLIC, anon, authenticated/);
  assert.match(cleanupSql, /GRANT SELECT ON public\.v_under13_pending_cleanup_candidates TO service_role/);
});

test('29D SECURITY DEFINER RPC ACLs remain explicit and search paths pinned', () => {
  for (const name of ['link_child_account', 'get_my_effective_plan', 'get_parent_children']) {
    assert.ok(childMigration.includes(`REVOKE EXECUTE ON FUNCTION public.${name}() FROM PUBLIC, anon, authenticated;`));
  }
  for (const fn of [linkSql, planSql, parentSql]) {
    assert.match(fn, /SECURITY DEFINER/);
    assert.match(fn, /SET search_path = public/);
  }
  assert.match(childMigration, /GRANT EXECUTE ON FUNCTION public\.link_child_account\(\) TO authenticated, service_role/);
  assert.match(childMigration, /GRANT EXECUTE ON FUNCTION public\.get_my_effective_plan\(\) TO authenticated, service_role/);
  assert.match(childMigration, /GRANT EXECUTE ON FUNCTION public\.get_parent_children\(\) TO authenticated;/);
});

test('29D historical migrations 00001-00075 remain unchanged relative to HEAD', () => {
  const changed = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'supabase/migrations'], {
    cwd: new URL('../', import.meta.url), encoding: 'utf8',
  }).trim().split(/\r?\n/).filter(Boolean);
  assert.deepEqual(changed.filter(path => !path.endsWith('/00076_child_profiles_authorization_hardening.sql')), []);
  assert.doesNotMatch(childMigration, /CREATE OR REPLACE FUNCTION public\.check_child_limit/);
});
