import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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
