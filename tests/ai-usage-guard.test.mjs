import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { getAiAccountDenial } from '../supabase/functions/_shared/account-access.ts';

const userId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const reservationId = '33333333-3333-4333-8333-333333333333';
const sources = new Map();
async function source(path) {
  if (!sources.has(path)) sources.set(path, await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  return sources.get(path);
}
const compiled = new Map();

// Execute actual handlers with Auth/DB/provider doubles. SQL contracts below are
// static checks: no PostgreSQL execution, ACL enforcement or concurrency proof.
async function loadEndpoint(name, options = {}) {
  if (!compiled.has(name)) {
    const body = (await source(`supabase/functions/${name}/index.ts`)).replace(/^import .*;\r?\n/gm, '');
    compiled.set(name, ts.transpileModule(body, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText);
  }
  const state = { reservations: [], providers: [], deletes: [], updates: [], logs: [], order: [] };
  const session = { user_id: userId, subject: null, raw_ocr_text: 'OCR text', ...options.session };
  const createClient = (url, key) => ({
    auth: { async getUser() {
      return { data: { user: options.authError ? null : { id: userId } }, error: options.authError ?? null };
    } },
    async rpc(fn, params) {
      if (fn === 'get_my_effective_plan') return { data: { effective_plan: options.plan ?? 'free' } };
      assert.equal(fn, 'check_and_reserve_ai_usage');
      assert.equal(key, 'test-service'); // Reservation uses the backend client.
      state.reservations.push(params);
      state.order.push('reserve');
      if (options.rpcThrow) throw new Error('private RPC transport failure');
      return {
        data: Object.hasOwn(options, 'guard') ? options.guard : { allowed: true, reservation_id: reservationId },
        error: options.rpcError ?? null,
      };
    },
    from(table) {
      if (table === 'profiles') return { select(columns) {
        assert.equal(columns, 'account_status');
        return { eq(column, id) {
          assert.equal(column, 'id'); assert.equal(id, userId);
          return { async maybeSingle() {
            return { data: { account_status: options.accountStatus ?? 'active' }, error: null };
          } };
        } };
      } };
      if (table === 'study_sessions') return {
        select() { return { eq(column, id) {
          assert.equal(column, 'id'); assert.equal(id, sessionId);
          return { async single() { return {
            data: options.missingSession ? null : session, error: options.selectError ?? null,
          }; } };
        } }; },
        update(payload) { return { async eq(column, id) {
          assert.equal(column, 'id'); assert.equal(id, sessionId);
          state.updates.push(payload); state.order.push('update');
          return { error: options.updateError ?? null };
        } }; },
      };
      if (table === 'usage_events') return {
        select() { assert.fail('Old COUNT-before-provider must not run'); },
        insert() { assert.fail('Post-success duplicate INSERT must not run'); },
        delete() { return { eq(column, id) {
          assert.equal(column, 'id');
          return { async eq(userColumn, uid) {
            assert.equal(userColumn, 'user_id');
            state.deletes.push({ id, userId: uid });
            state.order.push('delete-start');
            await Promise.resolve();
            if (options.deleteThrow) throw new Error('private cleanup transport failure');
            state.order.push('delete-done');
            return { error: options.deleteError ?? null };
          } };
        } }; },
      };
      if (table === 'session_images') return { select() { return { eq() { return {
        async order() { return { data: [], error: null }; },
      }; } }; } };
      assert.fail(`Unexpected table ${table}`);
    },
    storage: { from(bucket) {
      assert.equal(bucket, 'study-materials');
      return { async download() {
        return options.storageError
          ? { data: null, error: { message: 'storage unavailable' } }
          : { data: new Blob(['image']), error: null };
      } };
    } },
  });
  const fetchProvider = async url => {
    const kind = url.includes('vision.googleapis.com') ? 'vision' : 'openai';
    state.providers.push(kind); state.order.push(kind);
    if (options.providerThrow) throw new Error('provider transport failure');
    if (kind === 'vision') {
      const payload = options.visionError ? { error: { message: 'OCR failed' } }
        : { responses: [{ fullTextAnnotation: { text: options.emptyOcr ? '' : 'OCR text' } }] };
      return new Response(JSON.stringify(payload), { status: options.visionError ? 502 : 200 });
    }
    const generation = options.generation ?? {
      subject: 'Biology', topic: 'Cells', summary: 'Summary', keyConcepts: [],
      flashcards: [{ front: 'Question', back: 'Answer', difficulty: 'easy' }],
      quizQuestions: [{ question: 'Question', options: ['A', 'B', 'C', 'D'], correctIndex: 0 }],
    };
    const payload = { choices: [{ message: { content: options.content ?? JSON.stringify(generation) } }] };
    return new Response(options.rawOpenAi ?? JSON.stringify(payload), { status: options.providerStatus ?? 200 });
  };
  let handler;
  const boot = new Function('serve', 'createClient', 'getAiAccountDenial', 'Deno', 'fetch', 'console', 'crypto', 'performance', compiled.get(name));
  boot(fn => { handler = fn; }, createClient, getAiAccountDenial, {
    env: { get(key) {
      if (key === options.missingKey) return undefined;
      return key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-service' : 'test-config';
    } },
  }, fetchProvider, {
    log() {}, warn() {}, info() {}, error(...args) { state.logs.push(args); },
  }, crypto, performance);
  return { state, async request(body = { sessionId, module: options.module ?? 'quiz' }, authorized = true) {
    const response = await handler(new Request('https://example.invalid/ai', {
      method: 'POST', headers: {
        'Content-Type': 'application/json', ...(authorized ? { Authorization: 'Bearer test' } : {}),
      }, body: JSON.stringify(body),
    }));
    state.order.push('response');
    return response;
  } };
}

function assertExactRelease(state) {
  assert.deepEqual(state.deletes, [{ id: reservationId, userId }]);
  assert.ok(state.order.indexOf('delete-done') < state.order.indexOf('response'));
}

for (const [name, module, event, feature] of [
  ['analyze-notes', 'quiz', 'lesson_analysis', 'ai_lessons'],
  ['regenerate-module', 'flashcards', 'flashcard_regen', 'flashcard_regen'],
  ['regenerate-module', 'quiz', 'quiz_regen', 'quiz_regen'],
]) {
  const label = `${name}/${module}`;
  test(`${label}: reserves correct event once before provider; success consumes it`, async () => {
    const { state, request } = await loadEndpoint(name, { module });
    assert.equal((await request()).status, 200);
    assert.deepEqual(state.reservations, [{ p_user_id: userId, p_session_id: sessionId, p_event_type: event, p_plan: 'free' }]);
    assert.ok(state.order.indexOf('reserve') < state.order.indexOf('openai'));
    assert.equal(state.updates.length, 1);
    assert.equal(state.deletes.length, 0);
    assert.ok(!state.logs.some(args => args[0] === '[analyze-notes] OpenAI provider error'));
  });
  for (const [reason, guard] of [
    ['null', null], ['empty object', {}], ['array', []], ['scalar', 'allowed'],
    ['null allowed', { allowed: null }], ['missing ID', { allowed: true }],
    ['invalid UUID', { allowed: true, reservation_id: 'bad-id' }],
    ['UUID with trailing newline', { allowed: true, reservation_id: `${reservationId}\n` }],
    ['numeric ID', { allowed: true, reservation_id: 123 }],
    ['object ID', { allowed: true, reservation_id: {} }],
    ['bare denial', { allowed: false }],
    ['ownership denial', { allowed: false, reason: 'session_not_found' }],
    ['wrong feature', { allowed: false, error: 'usage_limit_reached', feature: 'wrong', limit: 1, message: 'Limit reached' }],
    ['string limit', { allowed: false, error: 'usage_limit_reached', feature, limit: '1', message: 'Limit reached' }],
    ['infinite limit', { allowed: false, error: 'usage_limit_reached', feature, limit: Infinity, message: 'Limit reached' }],
    ['NaN limit', { allowed: false, error: 'usage_limit_reached', feature, limit: NaN, message: 'Limit reached' }],
    ['empty message', { allowed: false, error: 'usage_limit_reached', feature, limit: 1, message: '  ' }],
    ['missing message', { allowed: false, error: 'usage_limit_reached', feature, limit: 1 }],
  ]) test(`${label}: malformed guard (${reason}) => 503, no provider`, async () => {
    const { state, request } = await loadEndpoint(name, { module, guard });
    const response = await request();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'usage_guard_unavailable' });
    assert.deepEqual(state.providers, []);
    assert.deepEqual(state.deletes, []);
    assert.deepEqual(state.updates, []);
  });
  for (const failure of [{ rpcError: { message: 'private DB details' } }, { rpcThrow: true }]) {
    test(`${label}: ${failure.rpcThrow ? 'RPC throws' : 'RPC DB error'} => 503, no provider`, async () => {
      const { state, request } = await loadEndpoint(name, { module, ...failure });
      const response = await request();
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: 'usage_guard_unavailable' });
      assert.deepEqual(state.providers, []);
    });
  }
  test(`${label}: valid limit denial => 403, no provider, minimal public payload`, async () => {
    const { state, request } = await loadEndpoint(name, { module, guard: {
      allowed: false, error: 'usage_limit_reached', feature, limit: 1,
      message: 'Osiągnięto limit.', privateDetails: 'do not disclose',
    } });
    const response = await request();
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'usage_limit_reached', feature, limit: 1, plan: 'free', message: 'Osiągnięto limit.' });
    assert.deepEqual(state.providers, []);
  });
  for (const [reason, options, authorized] of [
    ['unauthorized', {}, false], ['pending account', { accountStatus: 'pending_parent_consent' }, true],
    ['missing session', { missingSession: true }, true],
    ['wrong owner', { session: { user_id: '44444444-4444-4444-8444-444444444444' } }, true],
  ]) test(`${label}: ${reason} does not reserve`, async () => {
    const { state, request } = await loadEndpoint(name, { module, ...options });
    assert.ok((await request({ sessionId, module }, authorized)).status >= 400);
    assert.deepEqual(state.reservations, []);
    assert.deepEqual(state.providers, []);
  });
  for (const [reason, options] of [
    ['provider HTTP error', { providerStatus: 502 }],
    ['provider JSON error', { providerStatus: 502, rawOpenAi: '{"error":{"message":"down"}}' }],
    ['provider transport', { providerThrow: true }],
    ['invalid response JSON', { rawOpenAi: '<html>down</html>' }],
    ['missing content', { rawOpenAi: '{"choices":[{"message":{}}]}' }],
    ['unexpected response shape', { rawOpenAi: '{}' }],
    ['invalid generated JSON', { content: 'not JSON' }],
    ['DB update failure', { updateError: { message: 'write failed' } }],
  ]) test(`${label}: ${reason} releases exact reservation before response`, async () => {
    const { state, request } = await loadEndpoint(name, { module, ...options });
    assert.ok((await request()).status >= 500);
    assertExactRelease(state);
  });
  for (const failure of [{ deleteError: { message: 'private cleanup DB error' } }, { deleteThrow: true }]) {
    test(`${label}: cleanup ${failure.deleteThrow ? 'throw' : 'returned error'} is logged; original error survives`, async () => {
      const { state, request } = await loadEndpoint(name, { module, providerThrow: true, ...failure });
      const response = await request();
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: 'provider transport failure' });
      assert.deepEqual(state.deletes, [{ id: reservationId, userId }]);
      assert.ok(state.logs.some(args => String(args[0]).includes('Reservation cleanup failure')));
    });
  }
}

for (const [label, status, error, expectedType, expectedCode] of [
  ['rate limit', 429, { type: 'rate_limit_error', code: 'rate_limit_exceeded' }, 'rate_limit_error', 'rate_limit_exceeded'],
  ['authentication', 401, { type: 'authentication_error', code: 'invalid_api_key' }, 'authentication_error', 'invalid_api_key'],
  ['error object with HTTP 200', 200, { type: 'server_error', code: 'provider_error' }, 'server_error', 'provider_error'],
  ['non-string metadata', 503, { type: 123, code: { private: 'DO_NOT_LOG_CODE_OBJECT' } }, null, null],
  ['non-2xx without error object', 502, null, null, null],
  ['non-2xx invalid JSON', 502, undefined, null, null],
]) test(`analyze: ${label} emits one safe diagnostic and preserves cleanup/502`, async () => {
  const sensitive = [
    'PRIVATE_PROVIDER_MESSAGE', 'test-config', 'Authorization', 'Bearer test',
    'PRIVATE_OCR_TEXT', 'PRIVATE_PROMPT', 'private-user@example.invalid',
    'DO_NOT_LOG_CODE_OBJECT',
  ];
  const rawOpenAi = error === undefined ? sensitive.join(' ') : JSON.stringify({
    ...(error ? { error: { ...error, message: sensitive.join(' ') } } : {}),
    prompt: 'PRIVATE_PROMPT', ocrText: 'PRIVATE_OCR_TEXT',
    headers: { Authorization: 'Bearer test-config' }, user: 'private-user@example.invalid',
  });
  const { state, request } = await loadEndpoint('analyze-notes', {
    providerStatus: status, rawOpenAi, session: { raw_ocr_text: 'PRIVATE_OCR_TEXT' },
  });
  const response = await request();
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: error === undefined
    ? 'AI processing error: invalid response format'
    : error ? 'OpenAI API error: ai_analysis_failed' : `OpenAI HTTP error ${status}` });
  assertExactRelease(state);
  const diagnostics = state.logs.filter(args => args[0] === '[analyze-notes] OpenAI provider error');
  assert.deepEqual(diagnostics, [['[analyze-notes] OpenAI provider error', {
    status, type: expectedType, code: expectedCode,
  }]]);
  const logged = JSON.stringify(state.logs);
  for (const value of sensitive) assert.ok(!logged.includes(value), `Sensitive value logged: ${value}`);
  assert.equal(state.updates.length, 0);
});

test('analyze: already analyzed returns before reservation', async () => {
  const { state, request } = await loadEndpoint('analyze-notes', { session: { subject: 'Done' } });
  assert.equal((await request()).status, 200);
  assert.deepEqual(state.reservations, []); assert.deepEqual(state.providers, []);
});
for (const [reason, options, status] of [
  ['storage failure', { storageError: true }, 500],
  ['Vision failure', { visionError: true }, 502],
  ['no OCR text', { emptyOcr: true }, 422],
  ['missing Vision key', { missingKey: 'GOOGLE_VISION_API_KEY' }, 500],
]) test(`analyze: ${reason} releases exact reservation`, async () => {
  const { state, request } = await loadEndpoint('analyze-notes', {
    session: { raw_ocr_text: null, image_url: `${userId}/image.png` }, ...options,
  });
  assert.equal((await request()).status, status);
  assertExactRelease(state);
  assert.ok(!state.providers.includes('openai'));
  if (state.providers.includes('vision')) assert.ok(state.order.indexOf('reserve') < state.order.indexOf('vision'));
});
test('analyze: direct-return failure keeps original error when cleanup DB fails', async () => {
  const { state, request } = await loadEndpoint('analyze-notes', {
    session: { raw_ocr_text: null, image_url: `${userId}/image.png` },
    storageError: true, deleteError: { message: 'private cleanup error' },
  });
  const response = await request();
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Storage download failed: storage unavailable' });
  assert.deepEqual(state.deletes, [{ id: reservationId, userId }]);
  assert.ok(state.logs.some(args => String(args[0]).includes('Reservation cleanup failure')));
});
for (const body of [{ sessionId, module: 'invalid' }, { sessionId }]) {
  test(`regenerate: invalid module input ${JSON.stringify(body)} does not reserve`, async () => {
    const { state, request } = await loadEndpoint('regenerate-module');
    assert.equal((await request(body)).status, 400); assert.deepEqual(state.reservations, []);
  });
}
test('regenerate: missing OCR does not reserve', async () => {
  const { state, request } = await loadEndpoint('regenerate-module', { session: { raw_ocr_text: null } });
  assert.equal((await request()).status, 422); assert.deepEqual(state.reservations, []);
});
for (const [plan, maxCards] of [['free', 5], ['premium', 20], ['family', 20], ['unknown', 5]]) {
  test(`regenerate: ${plan} retains ${maxCards} card cap`, async () => {
    const flashcards = Array.from({ length: 25 }, (_, i) => ({ front: `unique${i}`, back: `answer${i}` }));
    const { state, request } = await loadEndpoint('regenerate-module', { plan, module: 'flashcards', generation: { flashcards } });
    const response = await request(); assert.equal(response.status, 200);
    assert.equal((await response.json()).data.length, maxCards);
    assert.equal(state.reservations[0].p_plan, plan === 'unknown' ? 'free' : plan);
  });
}

const sql = await source('supabase/migrations/00075_atomic_ai_usage_limits.sql');
const sqlCode = sql.replace(/--[^\n]*/g, '');
test('SQL contract: function dollar quotes are exact, paired and reject malformed variants', () => {
  const checkDelimiters = candidate => {
    const opening = candidate.match(/^AS \$func\$\r?$/m);
    const closing = candidate.match(/^\$func\$;\r?$/m);
    assert.ok(opening, 'Missing exact AS $func$ opening');
    assert.ok(closing, 'Missing exact $func$; closing');
    assert.doesNotMatch(candidate, /^AS \$func[ \t]*\r?$/m);
    assert.doesNotMatch(candidate, /^\$func;[ \t]*\r?$/m);
    assert.equal((candidate.match(/\$func\$/g) ?? []).length, 2, 'Exactly one paired tag is required');
    assert.ok(opening.index + opening[0].length < closing.index, 'Opening must precede closing');
  };
  checkDelimiters(sqlCode);
  assert.throws(() => checkDelimiters(sqlCode.replace('AS $func$', 'AS $func')), assert.AssertionError);
  assert.throws(() => checkDelimiters(sqlCode.replace('$func$;', '$func;')), assert.AssertionError);
  assert.throws(() => checkDelimiters(sqlCode.replace('$func$;', '$other$;')), assert.AssertionError);
  assert.throws(() => checkDelimiters(`${sqlCode}\n$func$;`), assert.AssertionError);
});
const lockAt = sqlCode.indexOf('PERFORM pg_advisory_xact_lock');
const countAt = sqlCode.indexOf('SELECT count(*)');
const insertAt = sqlCode.indexOf('INSERT INTO public.usage_events');
for (const [event, freeLimit, paidLimit] of [
  ['lesson_analysis', 2, 10], ['flashcard_regen', 1, 5], ['quiz_regen', 1, 5],
]) test(`SQL contract: ${event} limits ${freeLimit}/${paidLimit}`, () => {
  const branch = sqlCode.match(new RegExp(`(?:IF|ELSIF) p_event_type = '${event}' THEN\\s+IF v_normalized_plan = 'free' THEN v_limit := (\\d+); ELSE v_limit := (\\d+); END IF;`));
  assert.ok(branch, 'Missing event-specific free/paid branch');
  assert.deepEqual(branch.slice(1).map(Number), [freeLimit, paidLimit]);
});
test('SQL contract: premium/family allowlist with all other plans falling back to free', () => {
  assert.match(sqlCode, /IF p_plan = 'premium' OR p_plan = 'family' THEN\s+v_normalized_plan := p_plan;\s+ELSE\s+v_normalized_plan := 'free';/);
});
test('SQL contract: transaction, exact event constraint and service-role ACL', () => {
  assert.match(sqlCode, /^\s*BEGIN;/); assert.match(sqlCode, /COMMIT;\s*$/);
  const constraint = sqlCode.match(/ADD CONSTRAINT valid_event_type CHECK \(event_type IN \(([^)]+)\)\)/);
  assert.ok(constraint);
  assert.deepEqual([...constraint[1].matchAll(/'([^']+)'/g)].map(m => m[1]), ['lesson_analysis', 'flashcard_regen', 'tutor_message', 'quiz_regen']);
  assert.match(sqlCode, /SECURITY DEFINER\s+SET search_path = public/);
  assert.match(sqlCode, /REVOKE ALL ON FUNCTION public\.check_and_reserve_ai_usage\(uuid, uuid, text, text\) FROM PUBLIC, anon, authenticated;/);
  assert.match(sqlCode, /GRANT EXECUTE ON FUNCTION public\.check_and_reserve_ai_usage\(uuid, uuid, text, text\) TO service_role;/);
  assert.equal((sqlCode.match(/GRANT EXECUTE/g) ?? []).length, 1);
});
test('SQL contract: ownership before lock, COUNT and single reservation INSERT', () => {
  assert.match(sqlCode, /IF p_event_type IN \('flashcard_regen', 'quiz_regen'\) THEN\s+IF p_session_id IS NULL/);
  assert.match(sqlCode, /IF p_event_type = 'lesson_analysis' AND p_session_id IS NOT NULL/);
  assert.equal((sqlCode.match(/IF v_session_owner <> p_user_id THEN/g) ?? []).length, 2);
  assert.equal((sqlCode.match(/FROM public\.study_sessions WHERE id = p_session_id/g) ?? []).length, 2);
  assert.ok(sqlCode.lastIndexOf('IF v_session_owner <> p_user_id THEN') < lockAt);
  assert.ok(lockAt > 0 && lockAt < countAt && countAt < insertAt);
  assert.equal((sqlCode.match(/INSERT INTO public\.usage_events/g) ?? []).length, 1);
  assert.match(sqlCode, /RETURNING id INTO v_reservation_id/);
  assert.match(sqlCode, /p_user_id::text \|\| p_event_type \|\| \(timezone\('utc', now\(\)\)::date\)::text/);
  assert.equal((sqlCode.match(/p_user_id::text \|\| p_session_id::text \|\| p_event_type/g) ?? []).length, 2);
  assert.match(sqlCode, /WHERE user_id = p_user_id\s+AND session_id = p_session_id\s+AND event_type = p_event_type/);
  assert.match(sqlCode, /created_at >= \(timezone\('utc', now\(\)\)::date\)::timestamp AT TIME ZONE 'UTC'/);
});

// Execute the actual UI action in isolation, including generic error handling.
async function quizErrorAction(status, body) {
  const quiz = await source('src/pages/app/QuizPage.tsx');
  const action = quiz.slice(quiz.indexOf('  const handleRegenerate = async'), quiz.indexOf('  const currentQuestion ='))
    .replaceAll('import.meta.env.VITE_SUPABASE_URL', "'https://example.invalid'")
    .replaceAll('import.meta.env.VITE_SUPABASE_ANON_KEY', "'test-anon'");
  const js = ts.transpileModule(action, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const alerts = [], messages = [], busy = [];
  const actionFn = new Function('routeId', 'supabase', 'confirm', 't', 'fetch', 'alert', 'setIsRegenerating', 'setRegenerationMessage', 'console', `${js}\nreturn handleRegenerate;`)(
    sessionId, { auth: { async getSession() { return { data: { session: { access_token: 'test' } } }; } } },
    () => true, key => key, async () => new Response(JSON.stringify(body), { status }),
    message => alerts.push(message), value => busy.push(value), value => messages.push(value), { error() {} },
  );
  await actionFn(); return { alerts, messages, busy };
}
test('QuizPage: exact 403 quota shows readable message without raw JSON', async () => {
  const result = await quizErrorAction(403, { error: 'usage_limit_reached', message: 'Osiągnięto limit quizu.' });
  assert.deepEqual(result.alerts, ['Osiągnięto limit quizu.']);
  assert.equal(result.messages.at(-1), null); assert.deepEqual(result.busy, [true, false]);
});
for (const [status, body] of [
  [401, { error: 'usage_limit_reached', message: 'must not be quota' }],
  [403, { error: 'account_access_denied', message: 'must not be quota' }],
  [500, { error: 'server_error' }], [503, { error: 'usage_guard_unavailable' }],
]) test(`QuizPage: ${status}/${body.error} remains generic`, async () => {
  const result = await quizErrorAction(status, body);
  assert.ok(result.alerts[0].startsWith(`quiz.notifications.error: HTTP ${status}:`));
  assert.deepEqual(result.busy, [true, false]);
});
