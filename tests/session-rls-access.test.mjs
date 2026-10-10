import { normalizationContract, assertArchivedMigrationsUnchanged } from './helpers/migration-provenance.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// STATIC_CONTRACT only. The companion pgTAP suite executes actual PostgreSQL RLS
// in a reviewed disposable local database; these checks do not replace that run.
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const migrationPath = 'supabase/migrations/' + normalizationContract.priv02_file;
const sql = await read(migrationPath);
const clean = sql.replace(/--[^\n]*/g, '').trim();
const policies = [...clean.matchAll(/CREATE POLICY (\w+)\s+ON public\.(\w+) AS (\w+) FOR (\w+) TO (\w+)\s+USING ([\s\S]*?)\s+WITH CHECK ([\s\S]*?);/g)];

test('STATIC_CONTRACT one transaction, four additive restrictive policies, no other changes', () => {
  assert.ok(clean.startsWith('BEGIN;'));
  assert.ok(clean.endsWith('COMMIT;'));
  assert.equal(policies.length, 4);
  assert.equal((clean.match(/CREATE POLICY/g) ?? []).length, 4);
  assert.equal(new Set(policies.map(p => p[1])).size, 4);
  assert.deepEqual(policies.map(p => p[2]), ['study_sessions', 'session_images', 'tutor_threads', 'tutor_messages']);
  for (const p of policies) assert.deepEqual(p.slice(3, 6), ['RESTRICTIVE', 'ALL', 'authenticated']);
  assert.doesNotMatch(clean, /\b(?:GRANT|REVOKE|DROP|ALTER|INSERT|UPDATE|DELETE|TRUNCATE)\s+(?:ON|TABLE|POLICY|FROM|INTO|public\.)/i);
  assert.doesNotMatch(clean, /CREATE (?:TABLE|FUNCTION|TRIGGER|VIEW)|storage\.|cron\.|auth\.users/i);
});

test('STATIC_CONTRACT both old-row and resulting-row checks are explicit and identical', () => {
  const normalize = expression => expression.replace(/\s+/g, ' ').trim();
  for (const policy of policies) assert.equal(normalize(policy[6]), normalize(policy[7]));
});

test('STATIC_CONTRACT sessions require owner and NULL deleted_at, including INSERT checks', () => {
  for (const expression of policies[0].slice(6)) {
    assert.match(expression, /user_id = \(SELECT auth\.uid\(\)\) AND deleted_at IS NULL/);
  }
});

test('STATIC_CONTRACT image checks correlate the exact session and require active owner', () => {
  for (const expression of policies[1].slice(6)) {
    assert.match(expression, /EXISTS \([\s\S]*FROM public\.study_sessions s/);
    assert.match(expression, /s\.id = session_images\.session_id/);
    assert.match(expression, /s\.user_id = \(SELECT auth\.uid\(\)\) AND s\.deleted_at IS NULL/);
  }
});

test('STATIC_CONTRACT threads require both thread and referenced session ownership', () => {
  for (const expression of policies[2].slice(6)) {
    assert.match(expression, /user_id = \(SELECT auth\.uid\(\)\) AND EXISTS/);
    assert.match(expression, /s\.id = tutor_threads\.session_id/);
    assert.match(expression, /s\.user_id = \(SELECT auth\.uid\(\)\) AND s\.deleted_at IS NULL/);
  }
});

test('STATIC_CONTRACT messages require message, thread and active session ownership', () => {
  for (const expression of policies[3].slice(6)) {
    assert.match(expression, /user_id = \(SELECT auth\.uid\(\)\) AND EXISTS/);
    assert.match(expression, /JOIN public\.study_sessions s ON s\.id = t\.session_id/);
    assert.match(expression, /t\.id = tutor_messages\.thread_id AND t\.user_id = \(SELECT auth\.uid\(\)\)/);
    assert.match(expression, /s\.user_id = \(SELECT auth\.uid\(\)\) AND s\.deleted_at IS NULL/);
  }
});

test('STATIC_CONTRACT preflight checks the complete security graph independently of policy names', () => {
  const preflight = clean.split('$preflight$')[1];
  assert.doesNotMatch(preflight, /policyname|Users can (?:select|insert|update|delete) own sessions/);
  assert.match(preflight, /FROM expected e FULL JOIN actual p\s+ON p\.tablename = e\.table_name AND p\.cmd = e\.command/);
  assert.match(preflight, /e\.table_name IS NULL OR p\.tablename IS NULL/);
  assert.match(preflight, /p\.permissive IS DISTINCT FROM 'PERMISSIVE'/);
  assert.match(preflight, /p\.roles IS DISTINCT FROM ARRAY\[e\.policy_role\]::name\[\]/);
  assert.match(preflight, /p\.using_expression IS DISTINCT FROM e\.using_expression/);
  assert.match(preflight, /p\.check_expression IS DISTINCT FROM e\.check_expression/);
  assert.match(preflight, /btrim\(regexp_replace\(p\.qual, '\[\[:space:\]\]\+', ' ', 'g'\)\)/);
  assert.match(preflight, /btrim\(regexp_replace\(p\.with_check, '\[\[:space:\]\]\+', ' ', 'g'\)\)/);
  assert.match(clean, /c\.relrowsecurity/);
  assert.match(clean, /c\.relowner = \(SELECT oid FROM pg_roles WHERE rolname = 'authenticated'\)/);
  assert.match(clean, /has_table_privilege\('authenticated', c\.oid, e\.command\)/);
  assert.match(clean, /rolname = 'authenticated' AND NOT rolbypassrls AND NOT rolsuper/);
  assert.match(clean, /rolname = 'service_role' AND rolbypassrls/);
  assert.match(clean, /RAISE EXCEPTION 'PRIV02 session policy\/ACL baseline mismatch/);
});

test('STATIC_CONTRACT baseline matches all 11 inspected live command/role/ownership definitions', () => {
  const owner = clean.match(/owner_expression constant text := '([^']+)'/)[1];
  const imageOwner = clean.match(/image_owner_expression constant text := '([^']+)'/)[1];
  assert.equal(owner, '(auth.uid() = user_id)');
  assert.equal(imageOwner, '(EXISTS ( SELECT 1 FROM study_sessions WHERE ((study_sessions.id = session_images.session_id) AND (study_sessions.user_id = auth.uid()))))');
  const expressions = { owner_expression: owner, image_owner_expression: imageOwner, NULL: null };
  const baseline = [...clean.matchAll(/\('(study_sessions|session_images|tutor_threads|tutor_messages)', '(SELECT|INSERT|UPDATE|DELETE)', '(authenticated|public)', (owner_expression|image_owner_expression|NULL), (owner_expression|image_owner_expression|NULL)\)/g)]
    .map(([, table, command, role, using, check]) => [table, command, role, expressions[using], expressions[check]]);
  assert.deepEqual(baseline, [
    ['study_sessions', 'SELECT', 'authenticated', owner, null],
    ['study_sessions', 'INSERT', 'authenticated', null, owner],
    ['study_sessions', 'UPDATE', 'authenticated', owner, owner],
    ['session_images', 'SELECT', 'public', imageOwner, null],
    ['session_images', 'INSERT', 'public', null, imageOwner],
    ['session_images', 'DELETE', 'public', imageOwner, null],
    ['tutor_threads', 'SELECT', 'public', owner, null],
    ['tutor_threads', 'INSERT', 'public', null, owner],
    ['tutor_threads', 'UPDATE', 'public', owner, null],
    ['tutor_messages', 'SELECT', 'public', owner, null],
    ['tutor_messages', 'INSERT', 'public', null, owner],
  ]);
  // No policyname is joined/compared, so the verified study_sessions_* names
  // and equivalent policy renames are accepted with these exact definitions.
  assert.doesNotMatch(clean.split('$preflight$')[1], /policyname/);
});

test('STATIC_CONTRACT study-session browser DELETE is neither required nor granted', () => {
  assert.doesNotMatch(clean, /\('study_sessions', '(?:DELETE|ALL)'/);
  assert.doesNotMatch(clean, /\bGRANT\b/);
  assert.equal(policies.filter(p => p[2] === 'study_sessions').length, 1);
  assert.deepEqual(policies[0].slice(3, 6), ['RESTRICTIVE', 'ALL', 'authenticated']);
  assert.doesNotMatch(clean, /\bAS PERMISSIVE\b|\bFOR DELETE\b/);
});

test('STATIC_CONTRACT no historical migration changed and new names do not collide', async () => {
  assertArchivedMigrationsUnchanged();
  const paths = [
    ...normalizationContract.archived.map(row => row.archive_path),
    'supabase/migrations/' + normalizationContract.baseline_file,
  ];
  for (const path of paths) {
    const current = await read(path);
    for (const policy of policies) assert.doesNotMatch(current, new RegExp('CREATE POLICY ["\\s]*' + policy[1] + '\\b'), path);
  }
});
test('STATIC_CONTRACT actual DB suite uses role/JWT boundaries, synthetic fixtures, ROLLBACK and no Storage', async () => {
  const runtime = await read('supabase/tests/priv02_soft_deleted_session_access.test.sql');
  assert.match(runtime, /BEGIN;/);
  assert.match(runtime, /SELECT no_plan\(\)/);
  assert.match(runtime, /SET LOCAL ROLE authenticated/);
  assert.match(runtime, /SET LOCAL ROLE service_role/);
  assert.match(runtime, /request\.jwt\.claim\.sub/);
  assert.match(runtime, /@example\.invalid/);
  assert.match(runtime, /WITH CHECK prevents/);
  assert.match(runtime, /forged message on foreign thread rejected/);
  assert.match(runtime, /service cleanup can delete historical fixture/);
  assert.match(runtime, /cmd IN \('ALL', 'DELETE'\)\)\s*,\s*0::bigint, 'study_sessions has no permissive browser DELETE policy'/);
  assert.match(runtime, /WITH removed AS \(DELETE FROM study_sessions WHERE id = pg_temp\.fixture\('new_session'\) RETURNING id\)\s+SELECT is\(\(SELECT count\(\*\) FROM removed\), 0::bigint, 'browser cannot delete active session'\)/);
  assert.match(runtime, /WITH removed AS \(DELETE FROM study_sessions WHERE id = pg_temp\.fixture\('deleted'\) RETURNING id\)\s+SELECT is\(\(SELECT count\(\*\) FROM removed\), 0::bigint, 'browser cannot delete historical soft-deleted session'\)/);
  assert.match(runtime, /active session remains after denied browser delete/);
  assert.match(runtime, /authenticated JWT resolves to user A/);
  assert.match(runtime, /authenticated JWT resolves to user B/);
  assert.doesNotMatch(runtime, /existing active session delete still works/);
  assert.match(runtime, /SELECT \* FROM finish\(\);\s*ROLLBACK;/);
  assert.doesNotMatch(runtime, /storage\.|https:\/\//);
});
