import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// HANDLER tests execute production TS with injected operations and a fake provider.
// SQL_CONTRACT tests inspect the actual migration. STATE_MODEL vectors explain its
// state contract; neither category is a PostgreSQL/lease/concurrency runtime proof.
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const migration = 'supabase/migrations/00082_under13_parent_reminders.sql';
const [sql, coreSource, templateSource, entry, config] = await Promise.all([
  read(migration), read('supabase/functions/_shared/under13-parent-reminder-core.ts'),
  read('supabase/functions/_shared/under13-parent-reminder-template.ts'),
  read('supabase/functions/send-under13-parent-reminders/index.ts'), read('supabase/config.toml'),
]);
function load(source, dependencies = {}) {
  const output = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }}).outputText;
  const exports = {};
  new Function('exports', 'require', output)(exports, name => {
    if (!(name in dependencies)) throw new Error('Unexpected import');
    return dependencies[name];
  });
  return exports;
}
const template = load(templateSource);
const core = load(coreSource, { './under13-parent-reminder-template.ts': template });
const at = Date.parse('2030-01-06T00:00:00Z');
const minute = 60000;
const hour = 60 * minute;
const day = 24 * hour;
const work = () => ({ event_id: 'synthetic-event', parent_user_id: 'synthetic-parent',
  claim_token: 'synthetic-claim', retention_deadline_at: '2030-01-08T00:00:00Z',
  idempotency_key: 'synthetic-opaque-key' });
const verified = () => ({ id: 'synthetic-parent', email: ' Parent@EXAMPLE.INVALID ', email_confirmed_at: '2030-01-01T00:00:00Z' });
function harness(overrides = {}) {
  const calls = { client: 0, config: 0, claim: [], parent: [], prepare: [], finish: [], provider: [], logs: [] };
  const backend = {
    claim: async batch => { calls.claim.push(batch); return overrides.items ?? [work()]; },
    parent: async id => { calls.parent.push(id); if (overrides.parentThrows) throw new Error('private email/uuid/provider payload'); return overrides.parent === undefined ? verified() : overrides.parent; },
    prepare: async (...args) => { calls.prepare.push(args); return overrides.prepared ?? { allowed: true, status: 'claimed', send_before: '2030-01-06T00:10:00Z' }; },
    finish: async (...args) => {
      calls.finish.push(args);
      if (overrides.finishThrows) throw new Error('private database details');
      if (overrides.finishResult) return overrides.finishResult;
      if (args[1] === 'accepted') return 'accepted';
      if (['provider_timeout', 'provider_5xx', 'provider_rate_limited', 'provider_conflict', 'parent_lookup_failed'].includes(args[1])) return 'retryable';
      if (['provider_auth_or_config', 'invalid_recipient', 'provider_rejected'].includes(args[1])) return 'terminal_error';
      return 'cancelled';
    },
  };
  Object.assign(backend, overrides.backend);
  const handler = core.createUnder13ParentReminderHandler({
    schedulerSecret: () => overrides.secret === undefined ? 'synthetic-scheduler-secret' : overrides.secret,
    createBackend: () => { calls.client++; return backend; },
    providerConfig: () => { calls.config++; return { apiKey: 'synthetic-provider-secret',
      from: 'sender@example.invalid', appBaseUrl: 'https://app.example.invalid', ...overrides.config }; },
    now: () => overrides.time ?? at,
    fetch: async (...args) => {
      calls.provider.push(args);
      if (overrides.fetchThrows) throw new Error('private provider details');
      if (overrides.fetch) return overrides.fetch(...args);
      return new Response('private provider response', { status: overrides.status ?? 200,
        headers: overrides.retryAfter ? { 'Retry-After': overrides.retryAfter } : {} });
    },
    log: counts => calls.logs.push(counts),
  });
  const run = async (options = {}) => {
    let headers = options.headers;
    if (!headers) {
      const secret = overrides.secret === undefined ? 'synthetic-scheduler-secret' : overrides.secret;
      const ts = Math.floor((overrides.time ?? at) / 1000).toString();
      const msg = `omninauka:under13-parent-reminder:v1\n${ts}`;
      let sig = '';
      if (secret) {
        sig = createHmac('sha256', secret).update(msg).digest('hex');
      }
      headers = { 'x-omninauka-reminder-ts': ts, 'x-omninauka-reminder-signature': sig };
    }
    const response = await handler(new Request('https://worker.example.invalid/?parent=attacker', {
      method: options.method ?? 'POST', headers,
      ...('body' in options ? { body: options.body } : {}),
    }));
    return { response, data: await response.json(), calls };
  };
  return { calls, run, backend };
}

for (const method of ['GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) test(`HANDLER ${method} rejected with zero privileged work`, async () => {
  const { response, calls } = await harness().run({ method });
  assert.equal(response.status, 405);
  assert.equal(calls.client + calls.config + calls.provider.length, 0);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});
const testSecret = 'synthetic-scheduler-secret';
const tsNow = Math.floor(at / 1000).toString();
const validSig = createHmac('sha256', testSecret).update(`omninauka:under13-parent-reminder:v1\n${tsNow}`).digest('hex');

const badAuthHeaders = [
  {},
  { 'x-omninauka-reminder-key': testSecret },
  { Authorization: 'Bearer synthetic-browser-token' },
  { 'x-omninauka-reminder-signature': validSig },
  { 'x-omninauka-reminder-ts': tsNow },
  { 'x-omninauka-reminder-ts': '', 'x-omninauka-reminder-signature': validSig },
  { 'x-omninauka-reminder-ts': tsNow + '.5', 'x-omninauka-reminder-signature': validSig },
  { 'x-omninauka-reminder-ts': '-' + tsNow, 'x-omninauka-reminder-signature': validSig },
  { 'x-omninauka-reminder-ts': '1e9', 'x-omninauka-reminder-signature': validSig },
  { 'x-omninauka-reminder-ts': tsNow.slice(0, -1) + ' ' + tsNow.slice(-1), 'x-omninauka-reminder-signature': validSig },
  { 'x-omninauka-reminder-ts': tsNow + 'a', 'x-omninauka-reminder-signature': validSig },
  { 'x-omninauka-reminder-ts': tsNow, 'x-omninauka-reminder-signature': validSig.substring(0, 63) },
  { 'x-omninauka-reminder-ts': tsNow, 'x-omninauka-reminder-signature': validSig.toUpperCase() },
  { 'x-omninauka-reminder-ts': tsNow, 'x-omninauka-reminder-signature': validSig.replace(/[0-9a-f]/g, 'z') },
  { 'x-omninauka-reminder-ts': tsNow, 'x-omninauka-reminder-signature': validSig.replace(/^./, validSig[0] === 'a' ? 'b' : 'a') },
  { 'x-omninauka-reminder-ts': tsNow, 'x-omninauka-reminder-signature': createHmac('sha256', 'wrong-secret').update(`omninauka:under13-parent-reminder:v1\n${tsNow}`).digest('hex') },
];

for (let i = 0; i < badAuthHeaders.length; i++) {
  test(`HANDLER unauthorized variant ${i} cannot claim or send`, async () => {
    const { response, calls } = await harness().run({ headers: badAuthHeaders[i] });
    assert.equal(response.status, 401);
    assert.equal(calls.client + calls.config + calls.claim.length + calls.parent.length + calls.provider.length, 0);
  });
}

test('HANDLER exact freshness window boundaries', async () => {
  const ts = Math.floor(at / 1000);
  // Valid bounds
  let headers = { 'x-omninauka-reminder-ts': (ts - 300).toString(), 'x-omninauka-reminder-signature': createHmac('sha256', testSecret).update(`omninauka:under13-parent-reminder:v1\n${ts - 300}`).digest('hex') };
  let { response } = await harness().run({ headers });
  assert.equal(response.status, 200);

  headers = { 'x-omninauka-reminder-ts': (ts + 300).toString(), 'x-omninauka-reminder-signature': createHmac('sha256', testSecret).update(`omninauka:under13-parent-reminder:v1\n${ts + 300}`).digest('hex') };
  ({ response } = await harness().run({ headers }));
  assert.equal(response.status, 200);

  // Invalid bounds (stale/future)
  headers = { 'x-omninauka-reminder-ts': (ts - 301).toString(), 'x-omninauka-reminder-signature': createHmac('sha256', testSecret).update(`omninauka:under13-parent-reminder:v1\n${ts - 301}`).digest('hex') };
  ({ response } = await harness().run({ headers }));
  assert.equal(response.status, 401);

  headers = { 'x-omninauka-reminder-ts': (ts + 301).toString(), 'x-omninauka-reminder-signature': createHmac('sha256', testSecret).update(`omninauka:under13-parent-reminder:v1\n${ts + 301}`).digest('hex') };
  ({ response } = await harness().run({ headers }));
  assert.equal(response.status, 401);
});

test('HANDLER missing server secret fails closed', async () => {
  const { response, calls } = await harness({ secret: null }).run();
  assert.equal(response.status, 401); assert.equal(calls.client, 0);
});
test('HANDLER fixed batch ignores malformed/body/query victim, email and batch input', async () => {
  const h = harness();
  const { data } = await h.run({ body: '{invalid json; child=attacker; batch=999' });
  assert.deepEqual(h.calls.claim, [20]); assert.deepEqual(h.calls.parent, ['synthetic-parent']);
  assert.equal(data.accepted, 1);
  assert.deepEqual(JSON.parse(h.calls.provider[0][1].body).to, ['parent@example.invalid']);
});
test('HANDLER empty claims perform no Auth/provider work', async () => {
  const { data, calls } = await harness({ items: [] }).run();
  assert.equal(data.claimed, 0); assert.equal(calls.parent.length + calls.provider.length, 0);
});
test('HANDLER malformed oversized DB batch fails closed before any recipient', async () => {
  const { response, calls } = await harness({ items: Array(21).fill(work()) }).run();
  assert.equal(response.status, 503); assert.equal(calls.parent.length + calls.provider.length, 0);
});
for (const [name, parent, category] of [
  ['no Auth parent', null, 'parent_unavailable'],
  ['no email', { id: 'synthetic-parent', email_confirmed_at: '2030-01-01' }, 'parent_unavailable'],
  ['wrong Auth identity', { ...verified(), id: 'other-synthetic-parent' }, 'parent_unavailable'],
  ['unconfirmed', { ...verified(), email_confirmed_at: null }, 'parent_email_unconfirmed'],
  ['phone-only confirmed_at', { id: 'synthetic-parent', email: 'parent@example.invalid', confirmed_at: '2030-01-01', phone_confirmed_at: '2030-01-01' }, 'parent_email_unconfirmed'],
  ['email flag absent', { id: 'synthetic-parent', email: 'parent@example.invalid' }, 'parent_email_unconfirmed'],
]) test(`HANDLER ${name} never hashes/prepares/sends`, async () => {
  const { calls } = await harness({ parent }).run();
  assert.equal(calls.prepare.length + calls.provider.length, 0);
  assert.equal(calls.finish[0][1], category);
});
test('HANDLER canonical Auth email is normalized and SHA256 frozen through fenced preparation', async () => {
  const { calls } = await harness().run();
  assert.equal(calls.prepare[0][1], createHash('sha256').update('parent@example.invalid').digest('hex'));
  assert.equal(calls.prepare[0][2], createHash('sha256').update(calls.provider[0][1].body).digest('hex'));
  assert.equal(calls.prepare[0][0].claim_token, 'synthetic-claim');
});
for (const state of ['cancelled', 'delivery_unknown', 'stale_claim', 'not_due', 'invalid_hash']) {
  test(`HANDLER final gate ${state} stops HTTP`, async () => {
    const { calls } = await harness({ prepared: { allowed: false, status: state } }).run();
    assert.equal(calls.provider.length, 0); assert.equal(calls.finish.length, 0);
  });
}
for (const [status, category] of [[200, 'accepted'], [202, 'accepted'], [299, 'accepted'],
  [429, 'provider_rate_limited'], [500, 'provider_5xx'], [503, 'provider_5xx'],
  [408, 'provider_timeout'], [409, 'provider_conflict'], [400, 'invalid_recipient'],
  [422, 'invalid_recipient'], [401, 'provider_auth_or_config'], [403, 'provider_auth_or_config'],
  [302, 'provider_rejected'], [404, 'provider_rejected']]) test(`HANDLER provider ${status} classified safely`, async () => {
  const { calls } = await harness({ status }).run();
  assert.equal(calls.finish[0][1], category);
  assert.equal(calls.finish[0][0].claim_token, 'synthetic-claim');
  assert.equal(calls.provider.length, 1);
});
test('HANDLER network exception becomes safe timeout and is not rapidly retried', async () => {
  const { data, calls } = await harness({ fetchThrows: true }).run();
  assert.equal(data.retryable, 1); assert.equal(calls.provider.length, 1);
  assert.equal(calls.finish[0][1], 'provider_timeout');
});
test('HANDLER parent lookup failure causes bounded scheduled retry, no provider attempt', async () => {
  const { calls } = await harness({ parentThrows: true }).run();
  assert.equal(calls.finish[0][1], 'parent_lookup_failed');
  assert.equal(calls.prepare.length + calls.provider.length, 0);
});
test('HANDLER Retry-After is forwarded through fenced result', async () => {
  const { calls } = await harness({ status: 429, retryAfter: '3600' }).run();
  assert.equal(calls.finish[0][2], 3600);
});
for (const [value, expected] of [[null, 0], ['bad', 0], ['20', 20], ['999999', 21600], ['-1', 0],
  ['Sun, 06 Jan 2030 01:00:00 GMT', 3600]]) test(`BEHAVIOR retry header ${value} bounded`, () => {
  assert.equal(core.retryAfterSeconds(value, at), expected);
});
test('HANDLER deadline reached stops before recipient/HTTP work', async () => {
  const { calls } = await harness({ time: Date.parse(work().retention_deadline_at) }).run();
  assert.equal(calls.parent.length + calls.provider.length, 0);
  assert.equal(calls.finish[0][1], 'deadline_passed');
});
test('HANDLER elapsed send bound after final gate stops HTTP', async () => {
  const { calls } = await harness({ prepared: { allowed: true, status: 'claimed', send_before: new Date(at).toISOString() } }).run();
  assert.equal(calls.provider.length, 0);
});
test('HANDLER malformed final send bound fails closed', async () => {
  const { response, calls } = await harness({ prepared: { allowed: true, status: 'claimed' } }).run();
  assert.equal(calls.provider.length, 0); assert.equal(response.status, 503);
});
test('HANDLER HTTP has abort signal, fixed key and no redirect authorization leakage', async () => {
  const { calls } = await harness().run();
  const options = calls.provider[0][1];
  assert.ok(options.signal instanceof AbortSignal); assert.equal(options.redirect, 'error');
  assert.equal(options.headers['Idempotency-Key'], 'synthetic-opaque-key');
  assert.equal(core.RESEND_HTTP_TIMEOUT_MS, 15000);
});
test('HANDLER provider timeout really aborts an open HTTP request at send bound', async () => {
  const h = harness({ prepared: { allowed: true, status: 'claimed', send_before: new Date(at + 20).toISOString() },
    fetch: async (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('private timeout')), { once: true });
    }) });
  await h.run(); assert.equal(h.calls.finish[0][1], 'provider_timeout');
  assert.equal(h.calls.provider.length, 1);
});
test('HANDLER ACK loss never invokes blind UPDATE or immediately resends', async () => {
  const { response, data, calls } = await harness({ finishThrows: true }).run();
  assert.equal(response.status, 503); assert.equal(data.accepted, 0);
  assert.equal(data.safe_failure, 1); assert.equal(calls.provider.length, 1);
});
test('HANDLER same reclaimed event uses identical provider key/payload after ACK loss', async () => {
  const first = harness({ finishThrows: true }); await first.run();
  const second = harness({ time: at + 15 * minute,
    prepared: { allowed: true, status: 'claimed', send_before: new Date(at + 25 * minute).toISOString() } });
  await second.run();
  assert.equal(first.calls.provider[0][1].body, second.calls.provider[0][1].body);
  assert.equal(first.calls.provider[0][1].headers['Idempotency-Key'], second.calls.provider[0][1].headers['Idempotency-Key']);
});
test('HANDLER stale finalizer cannot be reported as accepted', async () => {
  const { data } = await harness({ finishResult: 'stale_claim' }).run();
  assert.equal(data.accepted, 0); assert.equal(data.safe_failure, 1);
});
test('HANDLER safe response/logs include only aggregate numeric fields', async () => {
  const { data, calls } = await harness({ finishThrows: true }).run();
  assert.deepEqual(Object.keys(data).sort(), ['accepted', 'cancelled', 'claimed', 'delivery_unknown', 'duration_ms', 'retryable', 'safe_failure', 'terminal_error'].sort());
  assert.ok(Object.values(data).every(value => typeof value === 'number'));
  assert.deepEqual(calls.logs, [data]);
  assert.doesNotMatch(JSON.stringify(data), /synthetic|private|example|Bearer/);
});
test('HANDLER invalid environment configuration consumes no claims', async () => {
  const { response, calls } = await harness({ config: { appBaseUrl: 'http://unsafe.example.invalid' } }).run();
  assert.equal(response.status, 503); assert.equal(calls.client + calls.claim.length, 0);
});
test('TEMPLATE actionable parent-first copy and stable fixed UTC date', () => {
  const message = template.under13ParentReminderTemplate(work().retention_deadline_at, 'https://app.example.invalid');
  assert.match(message.text, /nie zostało jeszcze ukończone/);
  assert.match(message.text, /ponowne zalogowanie/);
  assert.match(message.text, /już powiązane, nie musisz nic robić/);
  assert.match(message.text, /anulować w Panelu Rodzica po zalogowaniu/);
  assert.match(message.text, /2030-01-08 00:00:00 UTC/);
  assert.match(message.html, /href="https:\/\/app.example.invalid\/app\/parent"/);
  assert.doesNotMatch(message.text, /48 godzin|2 dni|ustawow|usun|token|example.invalid@/);
});
for (const url of ['http://example.invalid', 'https://user:password@example.invalid',
  'https://example.invalid/?token=unsafe', 'https://example.invalid/#unsafe', 'https://example.invalid/path']) {
  test(`TEMPLATE rejects unsafe/non-origin configuration ${url.split(':')[0]}`, () => {
    assert.throws(() => template.under13ParentReminderTemplate(work().retention_deadline_at, url));
  });
}
test('TEMPLATE takes only fixed deadline/origin, no personal data', () => {
  assert.equal(template.under13ParentReminderTemplate.length, 2);
  assert.doesNotMatch(templateSource, /child_name|child_email|parent_name|school|grade|user_id|age_band|plan/);
});

const section = name => sql.split('AS $' + name + '$')[1].split('$' + name + '$;')[0];
const context = section('context');
const claim = section('claim');
const prepare = section('prepare');
const finish = section('finish');
test('SQL_CONTRACT migration is environment independent and notification-only', () => {
  assert.doesNotMatch(sql, /vault\.|pg_net|net\.http|cron\.schedule|https?:\/\/|RESEND_API_KEY|SERVICE_ROLE_KEY|SCHEDULER_SECRET|schema_migrations/i);
  assert.doesNotMatch(sql, /UPDATE public\.(profiles|child_profiles|parental_consents|payment_events|admin_plan_actions)|DELETE FROM|ALTER TABLE public\.profiles|link_child_account\(/i);
  assert.match(sql, /^BEGIN;/m); assert.match(sql, /COMMIT;\s*$/);
});
test('SQL_CONTRACT only D5 kind, unique child lifecycle and random opaque immutable key', () => {
  assert.match(sql, /CHECK \(notification_kind = 'd5_preapproval_reminder'\)/);
  assert.match(sql, /UNIQUE \(child_user_id, notification_kind\)/);
  assert.match(sql, /idempotency_key text NOT NULL DEFAULT gen_random_uuid\(\)::text UNIQUE/);
  assert.doesNotMatch(sql, /SET\s+idempotency_key|SET\s+parent_user_id|SET\s+child_profile_id/i);
  assert.match(claim, /ON CONFLICT \(child_user_id, notification_kind\) DO NOTHING/);
});
test('SQL_CONTRACT parent/relation deletion cannot erase the deduplication tombstone', () => {
  assert.match(sql, /child_user_id uuid NOT NULL REFERENCES public\.profiles\(id\) ON DELETE CASCADE/);
  assert.match(sql, /parent_user_id uuid NOT NULL,/); assert.match(sql, /child_profile_id uuid NOT NULL,/);
  assert.doesNotMatch(sql, /REFERENCES public\.child_profiles|parent_user_id uuid[^\n]*REFERENCES/);
});
test('SQL_CONTRACT private table has no raw PII/metadata/provider content columns', () => {
  const table = sql.split('CREATE TABLE')[1].split('CREATE INDEX')[0];
  assert.doesNotMatch(table, /\b(parent_email|child_email|name|school|grade|payload|metadata|jwt|secret)\s+(?:text|json)/i);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON TABLE public\.under13_parent_notifications FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql, /REVOKE ALL PRIVILEGES \(%s\)/);
  assert.doesNotMatch(sql, /GRANT .* ON TABLE|CREATE POLICY/);
});
for (const [signature, name] of [
  ['under13_parent_reminder_context(uuid)', 'context'],
  ['claim_due_under13_parent_reminders(integer)', 'claim'],
  ['prepare_under13_parent_reminder(uuid, uuid, text, text)', 'prepare'],
  ['finish_under13_parent_reminder(uuid, uuid, text, integer)', 'finish'],
]) test(`SQL_CONTRACT ${name} fixed definer and complete service-only signature privileges`, () => {
  const declaration = sql.split(`CREATE FUNCTION public.${signature.split('(')[0]}(`)[1].split('AS $')[0];
  assert.match(declaration, /SECURITY DEFINER SET search_path = public/);
  assert.ok(sql.includes(`ALTER FUNCTION public.${signature} OWNER TO postgres;`));
  assert.ok(sql.includes(`REVOKE EXECUTE ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated;`));
  assert.ok(sql.includes(`GRANT EXECUTE ON FUNCTION public.${signature} TO service_role;`));
});
test('SQL_CONTRACT canonical Auth child email, complete trusted preapproval and exact count', () => {
  for (const token of ['JOIN auth.users child_auth', 'lower(btrim(child_auth.email))',
    "p.age_band = 'under_13'", "p.user_role = 'student'", "p.account_status = 'pending_parent_preapproval'",
    "cp.status = 'pending_child_registration'", 'cp.child_user_id IS NULL',
    'cp.preapproval_integrity_version = 1', 'cp.guardian_consent_acknowledged_at IS NOT NULL',
    "cp.guardian_consent_version = 'child_email_preapproval_v1'", "parent.user_role = 'parent'",
    "parent.account_status = 'active'", 'parent.id <> p.id', 'count(*) OVER ()', 'q.qualifying_parent_count = 1']) assert.ok(context.includes(token), token);
  assert.doesNotMatch(context, /LIMIT|profiles\.email|p\.email/);
});
test('SQL_CONTRACT D5 inclusive, D7 exclusive and immutable original deadline', () => {
  assert.match(context, /clock_timestamp\(\) >= COALESCE\(p.pending_preapproval_since, p.created_at\) \+ interval '5 days'/);
  assert.match(context, /clock_timestamp\(\) < COALESCE\(p.pending_preapproval_since, p.created_at\) \+ interval '7 days'/);
  assert.match(context, /COALESCE\(p.pending_preapproval_since, p.created_at\) \+ interval '7 days' AS deadline_at/);
  assert.doesNotMatch(sql, /SET\s+(?:retention_deadline_at|pending_preapproval_since|created_at)/i);
});
test('SQL_CONTRACT already trusted linked/active exclusion retains 00081 integrity', () => {
  for (const token of ["linked.status IN ('linked', 'active')", 'linked.child_user_id = p.id',
    'linked.preapproval_integrity_version = 1', "linked_parent.user_role = 'parent'",
    'linked.parent_user_id <> p.id', 'linked.guardian_consent_acknowledged_at IS NOT NULL',
    "linked.guardian_consent_version = 'child_email_preapproval_v1'"]) assert.ok(context.includes(token));
  assert.match(context, /NOT EXISTS/);
});
test('SQL_CONTRACT bounded row claim and short consistent profile->event locks', () => {
  assert.match(claim, /LEAST\(20, GREATEST\(1, COALESCE\(p_batch_size, 20\)\)\)/);
  assert.match(claim, /FOR UPDATE OF p SKIP LOCKED/);
  assert.match(claim, /FOR UPDATE SKIP LOCKED/);
  assert.ok(prepare.indexOf('FROM public.profiles WHERE id = v_child_id FOR UPDATE') < prepare.indexOf('WHERE id = p_event_id FOR UPDATE'));
  assert.doesNotMatch(sql, /LOCK TABLE|ADVISORY|ACCESS EXCLUSIVE/i);
});
test('SQL_CONTRACT ten minute lease, active lease exclusion and new token after recovery', () => {
  assert.match(claim, /interval '10 minutes'/);
  assert.match(claim, /n.lease_expires_at <= clock_timestamp\(\)/);
  assert.match(claim, /v_event.lease_expires_at > v_now THEN CONTINUE/);
  assert.match(claim, /claim_token = gen_random_uuid\(\)/);
  assert.doesNotMatch(claim, /attempt_count = attempt_count \+ 1/);
});
for (const [name, block] of [['prepare', prepare], ['finish', finish]]) test(`SQL_CONTRACT ${name} rejects stale token/state/expired lease before updates`, () => {
  for (const token of ["v_event.status <> 'claimed'", 'v_event.claim_token IS DISTINCT FROM p_claim_token', 'v_event.lease_expires_at <= v_now']) assert.ok(block.includes(token));
  assert.ok(block.indexOf('stale_claim') < block.indexOf('UPDATE public.under13_parent_notifications'));
});
test('SQL_CONTRACT final gate revalidates full context, same parent/relation/deadline and both frozen hashes', () => {
  for (const token of ['under13_parent_reminder_context(v_child_id)', 'v_context.parent_id <> v_event.parent_user_id',
    'v_context.relation_id <> v_event.child_profile_id', 'v_context.deadline_at <> v_event.retention_deadline_at',
    'v_event.retention_deadline_at <= v_now', 'recipient_changed', 'payload_changed',
    'recipient_email_hash = COALESCE(recipient_email_hash, p_recipient_hash)',
    'payload_hash = COALESCE(payload_hash, p_payload_hash)']) assert.ok(prepare.includes(token));
});
test('SQL_CONTRACT attempts reserved only at final gate, 3 max/6h/backoff +15/+60', () => {
  assert.match(prepare, /attempt_count = attempt_count \+ 1/);
  assert.match(prepare, /attempt_count >= 3/); assert.match(prepare, /interval '6 hours'/);
  assert.match(prepare, /WHEN attempt_count = 0 THEN interval '15 minutes' ELSE interval '60 minutes'/);
  assert.match(prepare, /first_attempt_at = COALESCE\(first_attempt_at, v_now\)/);
  assert.match(finish, /GREATEST\(COALESCE\(v_event.next_attempt_at/);
  assert.match(finish, /LEAST\(v_event.retention_deadline_at, v_event.first_attempt_at \+ interval '6 hours'\)/);
});
test('SQL_CONTRACT abandoned/uncertain attempts stop with delivery_unknown, never a new key', () => {
  for (const block of [claim, prepare, finish]) {
    assert.match(block, /delivery_unknown/); assert.match(block, /retry_window_exhausted/);
    assert.match(block, /attempt_count >= 3/); assert.match(block, /interval '6 hours'/);
  }
  assert.match(claim, /v_event.status NOT IN \('pending', 'retryable', 'claimed'\)/);
});
test('SQL_CONTRACT deadline cancels retries independently of accepted/expiry status', () => {
  for (const block of [claim, prepare, finish]) assert.match(block, /deadline_passed/);
  assert.match(finish, /p_result = 'accepted' AND v_event.attempt_count > 0/);
  assert.match(finish, /provider_accepted_at = CASE WHEN v_status = 'accepted'/);
});
test('SQL_CONTRACT finalizer accepts only fixed safe categories, no arbitrary error persistence', () => {
  assert.match(finish, /ELSE RETURN 'invalid_result'/);
  assert.doesNotMatch(entry + coreSource, /\.message|console\.error|response\.json\(|response\.text\(|client\.from\(/);
  assert.match(entry, /p_event_id: work.event_id, p_claim_token: work.claim_token/);
});
test('STATIC wrapper canonical Auth lookup and dedicated lazy privileged client', () => {
  assert.match(entry, /auth.admin.getUserById\(id\)/);
  assert.match(entry, /createBackend: \(\) =>/);
  assert.doesNotMatch(entry, /parental_consents|profiles|link_child_account|deleteUser|storage\./);
  assert.match(config, /\[functions.send-under13-parent-reminders\][\s\S]*?verify_jwt = false/);
  assert.doesNotMatch(coreSource, /request\.(json|text|url)|searchParams|Access-Control-Allow-Origin/);
});

// Mock the documented SQL state machine, while exercising the REAL handler across
// scheduler invocations. This is intentionally not labelled an integration DB test.
function queueModel() {
  let time = at;
  let sequence = 0;
  let validRelationship = true;
  const event = { ...work(), state: 'pending', lease: 0, next: 0, attempts: 0,
    first: null, recipientHash: null, payloadHash: null };
  const owns = item => event.state === 'claimed' && item.claim_token === event.claim_token && event.lease > time;
  const backend = {
    claim: async () => {
      if (!['pending', 'retryable', 'claimed'].includes(event.state)) return [];
      if (event.state === 'claimed' && event.lease > time) return [];
      if (!validRelationship) { event.state = 'cancelled'; return []; }
      if (time >= Date.parse(event.retention_deadline_at)) { event.state = 'cancelled'; return []; }
      if (event.attempts >= 3 || (event.first !== null && time >= event.first + 6 * hour)) { event.state = 'delivery_unknown'; return []; }
      if (time < event.next) return [];
      event.state = 'claimed'; event.claim_token = `synthetic-claim-${++sequence}`;
      event.lease = time + 10 * minute;
      return [{ ...event }];
    },
    prepare: async (item, recipientHash, payloadHash) => {
      if (!owns(item)) return { allowed: false, status: 'stale_claim' };
      if (!validRelationship || (event.recipientHash && event.recipientHash !== recipientHash) ||
        (event.payloadHash && event.payloadHash !== payloadHash)) {
        event.state = 'cancelled'; return { allowed: false, status: 'cancelled' };
      }
      if (time < event.next) return { allowed: false, status: 'not_due' };
      event.recipientHash ??= recipientHash; event.payloadHash ??= payloadHash;
      event.first ??= time; event.attempts++; event.next = time + (event.attempts === 1 ? 15 * minute : hour);
      return { allowed: true, status: 'claimed', send_before: new Date(Math.min(event.lease, event.first + 6 * hour, Date.parse(event.retention_deadline_at))).toISOString() };
    },
    finish: async (item, result) => {
      if (!owns(item)) return 'stale_claim';
      event.state = result === 'accepted' ? 'accepted' : result === 'provider_timeout' ? 'retryable' : 'cancelled';
      return event.state;
    },
  };
  return { event, backend, advance: value => { time = value; }, invalidate: () => { validRelationship = false; } };
}
test('MOCKED_STATE full accepted lifecycle sends once across repeated scheduler invocations', async () => {
  const q = queueModel();
  const first = harness({ backend: q.backend }); await first.run();
  q.advance(at + 15 * minute);
  const again = harness({ time: at + 15 * minute, backend: q.backend }); await again.run();
  assert.equal(first.calls.provider.length, 1); assert.equal(again.calls.provider.length, 0);
  assert.equal(q.event.state, 'accepted'); assert.equal(q.event.attempts, 1);
});
test('MOCKED_STATE ACK lost after acceptance recovers same key and payload after lease/backoff', async () => {
  const q = queueModel();
  const first = harness({ backend: { ...q.backend, finish: async () => { throw new Error('Synthetic lost ACK'); } } });
  await first.run(); assert.equal(q.event.state, 'claimed');
  q.advance(at + 15 * minute);
  const again = harness({ time: at + 15 * minute, backend: q.backend }); await again.run();
  assert.equal(first.calls.provider[0][1].body, again.calls.provider[0][1].body);
  assert.equal(first.calls.provider[0][1].headers['Idempotency-Key'], again.calls.provider[0][1].headers['Idempotency-Key']);
  assert.equal(q.event.state, 'accepted'); assert.equal(q.event.attempts, 2);
});
test('MOCKED_STATE recipient changed after uncertain provider call cancels without redirecting', async () => {
  const q = queueModel();
  await harness({ backend: q.backend, fetchThrows: true }).run();
  const frozen = q.event.recipientHash;
  q.advance(at + 15 * minute);
  const h = harness({ backend: q.backend, time: at + 15 * minute, parent: { ...verified(), email: 'changed@example.invalid' } });
  await h.run(); assert.equal(h.calls.provider.length, 0); assert.equal(q.event.state, 'cancelled');
  assert.equal(q.event.recipientHash, frozen);
});
test('MOCKED_STATE payload config change stops retry even with same verified recipient', async () => {
  const q = queueModel(); await harness({ backend: q.backend, fetchThrows: true }).run();
  q.advance(at + 15 * minute);
  const h = harness({ backend: q.backend, time: at + 15 * minute, config: { from: 'changed-sender@example.invalid' } });
  await h.run(); assert.equal(h.calls.provider.length, 0); assert.equal(q.event.state, 'cancelled');
});
test('MOCKED_STATE old claim cannot finalize or overwrite hashes after lease takeover', async () => {
  const q = queueModel();
  const [old] = await q.backend.claim();
  await q.backend.prepare(old, 'a'.repeat(64), 'b'.repeat(64));
  q.advance(at + 15 * minute); const [newer] = await q.backend.claim();
  assert.notEqual(old.claim_token, newer.claim_token);
  assert.equal(await q.backend.finish(old, 'accepted'), 'stale_claim');
  assert.equal((await q.backend.prepare(old, 'c'.repeat(64), 'd'.repeat(64))).status, 'stale_claim');
  assert.equal(q.event.recipientHash, 'a'.repeat(64)); assert.equal(q.event.state, 'claimed');
});
test('MOCKED_STATE worker crash before provider preparation recovers with zero reserved attempts', async () => {
  const q = queueModel(); const [old] = await q.backend.claim();
  q.advance(at + 5 * minute); assert.deepEqual(await q.backend.claim(), []);
  q.advance(at + 15 * minute); const [newer] = await q.backend.claim();
  assert.notEqual(old.claim_token, newer.claim_token); assert.equal(q.event.attempts, 0);
});
test('MOCKED_STATE relationship invalidation cancels tombstone and never re-arms another recipient', async () => {
  const q = queueModel(); await q.backend.claim(); q.invalidate(); q.advance(at + 15 * minute);
  assert.deepEqual(await q.backend.claim(), []); assert.equal(q.event.state, 'cancelled');
  q.advance(at + 30 * minute); assert.deepEqual(await q.backend.claim(), []);
});
test('MOCKED_STATE lost result after three attempts becomes unknown and is never resent', async () => {
  const q = queueModel();
  for (const delta of [0, 15 * minute, 75 * minute]) {
    q.advance(at + delta);
    const h = harness({ backend: { ...q.backend, finish: async () => { throw new Error('Synthetic lost result'); } }, time: at + delta });
    await h.run(); assert.equal(h.calls.provider.length, 1);
  }
  q.advance(at + 2 * hour); const h = harness({ backend: q.backend, time: at + 2 * hour });
  await h.run(); assert.equal(q.event.state, 'delivery_unknown'); assert.equal(h.calls.provider.length, 0);
});
test('MOCKED_STATE unresolved result beyond six hours becomes unknown without provider request', async () => {
  const q = queueModel(); await harness({ backend: q.backend, fetchThrows: true }).run();
  q.advance(at + 6 * hour); const h = harness({ backend: q.backend, time: at + 6 * hour });
  await h.run(); assert.equal(q.event.state, 'delivery_unknown'); assert.equal(h.calls.provider.length, 0);
});
const trustedPreapprovalModel = (overrides = {}) => {
  const cp = { status: 'pending_child_registration', childUser: null, integrity: 1, acknowledgement: true,
    consentVersion: 'child_email_preapproval_v1', parentExists: true, parentRole: 'parent',
    parentState: 'active', sameIdentity: false, canonicalEmailMatch: true, ...overrides };
  return cp.status === 'pending_child_registration' && cp.childUser === null && cp.integrity === 1 &&
    cp.acknowledgement && cp.consentVersion === 'child_email_preapproval_v1' && cp.parentExists &&
    cp.parentRole === 'parent' && cp.parentState === 'active' && !cp.sameIdentity && cp.canonicalEmailMatch;
};
for (const [name, bad] of [
  ['archived relation', { status: 'archived' }], ['linked relation', { status: 'linked' }],
  ['bound child id', { childUser: 'synthetic-child' }], ['integrity zero', { integrity: 0 }],
  ['missing acknowledgement', { acknowledgement: false }], ['wrong consent version', { consentVersion: 'old' }],
  ['missing parent profile', { parentExists: false }], ['student parent', { parentRole: 'student' }],
  ['suspended parent', { parentState: 'suspended' }], ['parent equals child', { sameIdentity: true }],
  ['noncanonical email', { canonicalEmailMatch: false }],
]) test(`STATE_MODEL trusted preapproval excludes ${name}`, () => {
  assert.equal(trustedPreapprovalModel(bad), false); assert.equal(trustedPreapprovalModel(), true);
});

// A small explicit STATE_MODEL for SQL-only invariants; runtime SQL remains a rollout gate.
const contextModel = ({ clock = at - 5 * day, age = 'under_13', status = 'pending_parent_preapproval',
  role = 'student', trustedLinked = false, matches = 1 } = {}, time = at) =>
  clock != null && time >= clock + 5 * day && time < clock + 7 * day && age === 'under_13' &&
  status === 'pending_parent_preapproval' && role === 'student' && !trustedLinked && matches === 1;
for (const [name, input, expected] of [
  ['before D5', { clock: at - 5 * day + minute }, false],
  ['at D5', {}, true], ['inside D5-D7', { clock: at - 6 * day }, true],
  ['at D7', { clock: at - 7 * day }, false], ['after D7', { clock: at - 8 * day }, false],
  ['missing clock', { clock: null }, false], ['wrong age', { age: '13_15' }, false],
  ['active child', { status: 'active' }, false], ['expired child', { status: 'expired_pending_preapproval' }, false],
  ['wrong role', { role: 'parent' }, false], ['already linked', { trustedLinked: true }, false],
  ['zero parents', { matches: 0 }, false], ['two parents', { matches: 2 }, false],
]) test(`STATE_MODEL eligibility ${name}`, () => assert.equal(contextModel(input), expected));
function retryModel({ attempts = 1, first = at, last = at, next = null, deadline = at + 2 * day, status = 'retryable', lease = null } = {}, time = at) {
  if (!['pending', 'retryable', 'claimed'].includes(status)) return 'stop';
  if (status === 'claimed' && lease > time) return 'busy';
  if (deadline <= time) return 'cancelled';
  if (attempts >= 3 || time >= first + 6 * hour) return 'delivery_unknown';
  const due = next ?? last + (attempts === 1 ? 15 * minute : 60 * minute);
  return time < due ? 'wait' : 'claim';
}
for (const [name, state, time, expected] of [
  ['retry2 before15', {}, at + 14 * minute, 'wait'], ['retry2 at15', {}, at + 15 * minute, 'claim'],
  ['retry3 before60', { attempts: 2 }, at + 59 * minute, 'wait'], ['retry3 at60', { attempts: 2 }, at + hour, 'claim'],
  ['attempt limit', { attempts: 3 }, at + hour, 'delivery_unknown'],
  ['six hour boundary', {}, at + 6 * hour, 'delivery_unknown'],
  ['D7 first', { deadline: at + minute }, at + minute, 'cancelled'],
  ['accepted never retries', { status: 'accepted' }, at + hour, 'stop'],
  ['cancelled never retries', { status: 'cancelled' }, at + hour, 'stop'],
  ['terminal never retries', { status: 'terminal_error' }, at + hour, 'stop'],
  ['unknown never retries', { status: 'delivery_unknown' }, at + hour, 'stop'],
  ['active lease busy', { status: 'claimed', lease: at + 10 * minute }, at + 5 * minute, 'busy'],
  ['crash recovered after lease and backoff', { status: 'claimed', lease: at + 10 * minute }, at + 15 * minute, 'claim'],
  ['Retry-After respects next', { next: at + 2 * hour }, at + hour, 'wait'],
]) test(`STATE_MODEL ${name}`, () => assert.equal(retryModel(state, time), expected));

test('FREEZE 00081 exact accepted hash retained', async () => {
  const data = await readFile(new URL('supabase/migrations/00081_under13_pending_retention_cleanup.sql', root));
  assert.equal(createHash('sha256').update(data).digest('hex').toUpperCase(), 'B64299CC4CED12A0A68525F15B1F50B17C2AEE2E5AB3EAFF526AD34E030BDF14');
});
test('FREEZE historical migrations, Stripe, consent, auth and all frontend unchanged', () => {
  const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: new URL('../', import.meta.url), encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
  assert.ok(changed.every(path => ['supabase/config.toml', 'supabase/functions/_shared/under13-parent-reminder-core.ts', 'supabase/functions/_shared/under13-parent-reminder-template.ts', 'supabase/functions/send-under13-parent-reminders/index.ts', 'supabase/migrations/00082_under13_parent_reminders.sql', 'tests/priv01-parent-reminder.test.mjs', 'tests/priv01-under13-retention.test.mjs'].includes(path)), changed.join('\n'));
});
test('TYPECHECK shared production TS against installed compiler without emitting files', () => {
  const names = ['supabase/functions/_shared/under13-parent-reminder-core.ts', 'supabase/functions/_shared/under13-parent-reminder-template.ts'].map(path => fileURLToPath(new URL(path, root)));
  const program = ts.createProgram(names, { noEmit: true, strict: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true, skipLibCheck: true });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => process.cwd(), getCanonicalFileName: name => name, getNewLine: () => '\n',
  }));
});
test('TYPECHECK Edge adapter with real installed Supabase types and virtual Deno globals', () => {
  // No Deno installation/download and no temporary file. Only the runtime globals
  // and serve URL are declared; client/Auth/RPC typing uses the installed SDK.
  const virtualPath = fileURLToPath(new URL('supabase/functions/__reminder_runtime_virtual.d.ts', root)).replaceAll('\\', '/');
  const declarations = `declare const Deno: { env: { get(name: string): string | undefined } };
    declare module 'https://deno.land/std@0.168.0/http/server.ts' {
      export function serve(handler: (request: Request) => Promise<Response>): void;
    }
    declare module 'npm:@supabase/supabase-js@2' { export { createClient } from '@supabase/supabase-js'; }`;
  const options = { noEmit: true, strict: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true, skipLibCheck: true };
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const originalFileExists = host.fileExists.bind(host);
  const originalReadFile = host.readFile.bind(host);
  const isVirtual = name => name.replaceAll('\\', '/') === virtualPath;
  host.fileExists = name => isVirtual(name) || originalFileExists(name);
  host.readFile = name => isVirtual(name) ? declarations : originalReadFile(name);
  host.getSourceFile = (name, ...args) => isVirtual(name) ? ts.createSourceFile(name, declarations, options.target) : originalGetSourceFile(name, ...args);
  const program = ts.createProgram([fileURLToPath(new URL('supabase/functions/send-under13-parent-reminders/index.ts', root)), virtualPath], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => process.cwd(), getCanonicalFileName: name => name, getNewLine: () => '\n',
  }));
});
