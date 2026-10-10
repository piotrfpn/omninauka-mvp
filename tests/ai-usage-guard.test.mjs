import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
  const state = { reservations: [], providers: [], deletes: [], updates: [], logs: [], order: [], timers: new Map(), clearedTimers: [], aborted: false };
  let nextTimerId = 0;
  const setTimer = (callback, delay) => { const id = ++nextTimerId; state.timers.set(id, { callback, delay }); return id; };
  const clearTimer = id => { state.clearedTimers.push(id); state.timers.delete(id); };
  const waitForAbort = signal => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => {
      state.aborted = true;
      reject(new DOMException('PRIVATE_ABORT_DETAILS', 'AbortError'));
    }, { once: true });
    queueMicrotask(() => {
      const timer = [...state.timers.values()].find(timer => timer.delay === 60000);
      assert.ok(timer, 'Provider deadline must remain active');
      timer.callback();
    });
  });
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
  const fetchProvider = async (url, init) => {
    const kind = url.includes('vision.googleapis.com') ? 'vision' : 'openai';
    state.providers.push(kind); state.order.push(kind);
    if (options.providerThrow) throw new Error('provider transport failure');
    if (kind === 'vision') {
      const payload = options.visionError ? { error: { message: 'OCR failed' } }
        : { responses: [{ fullTextAnnotation: { text: options.emptyOcr ? '' : 'OCR text' } }] };
      return new Response(JSON.stringify(payload), { status: options.visionError ? 502 : 200 });
    }
    assert.ok(init.signal instanceof AbortSignal);
    if (options.providerTimeout) return waitForAbort(init.signal);
    if (options.bodyTimeout) return { ok: true, status: 200, text: () => waitForAbort(init.signal) };
    const generation = options.generation ?? {
      subject: 'Biology', topic: 'Cells', summary: 'Summary', keyConcepts: [],
      flashcards: [{ front: 'Question', back: 'Answer', difficulty: 'easy' }],
      quizQuestions: [{ question: 'Question', options: ['A', 'B', 'C', 'D'], correctIndex: 0 }],
    };
    const payload = { choices: [{ message: { content: options.content ?? JSON.stringify(generation) } }] };
    return new Response(options.rawOpenAi ?? JSON.stringify(payload), { status: options.providerStatus ?? 200 });
  };
  let handler;
  const boot = new Function('serve', 'createClient', 'getAiAccountDenial', 'Deno', 'fetch', 'console', 'crypto', 'performance', 'setTimeout', 'clearTimeout', compiled.get(name));
  boot(fn => { handler = fn; }, createClient, getAiAccountDenial, {
    env: { get(key) {
      if (key === options.missingKey) return undefined;
      return key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-service' : 'test-config';
    } },
  }, fetchProvider, {
    log() {}, warn() {}, info(...args) { state.logs.push(args); }, error(...args) { state.logs.push(args); },
  }, crypto, performance, setTimer, clearTimer);
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
    assert.equal(state.timers.size, 0);
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
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), { error: 'provider_error' });
      assert.deepEqual(state.deletes, [{ id: reservationId, userId }]);
      assert.ok(state.logs.some(args => String(args[0]).includes('Reservation cleanup failure')));
    });
  }
  for (const phase of ['providerTimeout', 'bodyTimeout']) {
    test(`${label}: ${phase} aborts once, releases exact reservation, clears deadline`, async () => {
      const { state, request } = await loadEndpoint(name, { module, [phase]: true });
      const response = await request();
      assert.equal(response.status, 504);
      assert.deepEqual(await response.json(), { error: 'provider_timeout' });
      assert.equal(state.aborted, true);
      assert.deepEqual(state.providers, ['openai']);
      assertExactRelease(state);
      assert.equal(state.timers.size, 0);
      assert.equal(state.clearedTimers.length, 1);
      assert.equal(state.updates.length, 0);
    });
  }
}

for (const [errorCode, status, options] of [
  ['provider_timeout', 504, { providerTimeout: true }],
  ['provider_error', 502, { providerThrow: true }],
]) test(`analyze: request_failed timing preserves ${errorCode} without private details`, async () => {
  const { state, request } = await loadEndpoint('analyze-notes', options);
  const response = await request();
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { error: errorCode });
  assertExactRelease(state);
  const markers = state.logs.filter(args => typeof args[0] === 'string' && args[0].startsWith('{'))
    .map(args => JSON.parse(args[0])).filter(entry => entry.marker === 'analyze-notes-timing' && entry.stage === 'request_failed');
  assert.equal(markers.length, 1);
  assert.equal(markers[0].errorCode, errorCode);
  assert.equal(markers[0].status, 'error');
  assert.ok(Number.isFinite(markers[0].elapsedMs));
  assert.equal(typeof markers[0].requestId, 'string');
  assert.deepEqual(Object.keys(markers[0]).sort(), ['elapsedMs', 'errorCode', 'marker', 'requestId', 'stage', 'status']);
  assert.equal(state.providers.length, 1);
});

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
  assert.deepEqual(await response.json(), { error: 'provider_error' });
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

const sql = await source('supabase/migration_archive/legacy_pre_baseline/00075_atomic_ai_usage_limits.sql');
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

// Execute the actual UI actions; fake timers exercise deadlines without wall-clock waits.
async function loadRegenerationAction(page, options = {}) {
  const sourceText = await source('src/pages/app/' + page + '.tsx');
  const action = sourceText.slice(sourceText.indexOf('  const handleRegenerate = async'), sourceText.indexOf('  const currentQuestion =') >= 0
    ? sourceText.indexOf('  const currentQuestion =') : sourceText.indexOf('  const currentCard ='))
    .replaceAll('import.meta.env.VITE_SUPABASE_URL', "'https://example.invalid'")
    .replaceAll('import.meta.env.VITE_SUPABASE_ANON_KEY', "'test-anon'");
  const js = ts.transpileModule(action, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const state = { alerts: [], messages: [], busy: [], fetches: 0, timers: new Map(), aborted: false, guard: { current: false } };
  let timerId = 0;
  let finishFetch;
  const waitForAbort = signal => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { state.aborted = true; reject(new DOMException('PRIVATE_TIMEOUT', 'AbortError')); }, { once: true });
    queueMicrotask(() => {
      const timer = [...state.timers.values()].find(timer => timer.delay === 90000);
      assert.ok(timer, 'Frontend deadline must cover fetch and body');
      timer.callback();
    });
  });
  const noop = () => {};
  const env = {
    routeId: sessionId, regenerationInFlight: state.guard,
    supabase: { auth: { async getSession() { return { data: { session: { access_token: 'test' } } }; } } },
    confirm: () => true, t: key => key,
    fetch: async (url, init) => {
      state.fetches++;
      assert.ok(init.signal instanceof AbortSignal);
      if (options.networkFailure) throw new TypeError('PRIVATE_NETWORK_DETAILS');
      if (options.fetchTimeout) return waitForAbort(init.signal);
      if (options.bodyTimeout) return { ok: true, status: 200, text: () => waitForAbort(init.signal) };
      if (options.bodyNetworkFailure) return { ok: true, status: 200, async text() { throw new TypeError('PRIVATE_BODY_NETWORK_DETAILS'); } };
      const response = new Response(JSON.stringify(options.body ?? { data: [] }), { status: options.status ?? 200 });
      if (options.pending) return new Promise(resolve => { finishFetch = () => resolve(response); });
      return response;
    },
    alert: message => state.alerts.push(message),
    setIsRegenerating: value => state.busy.push(value),
    setRegenerationMessage: value => state.messages.push(value),
    console: { error: noop }, effectivePlan: 'premium', hasUsedFreeRegen: false,
    quizQuestionCount: 12, maxFlashcardsPerLesson: 20,
    setQuestions: noop, setAttemptId: noop, setOrderMaps: noop, setCurrentIndex: noop,
    setAnswers: noop, setIsFinished: noop, setShowFeedback: noop, setFlashcards: noop,
    setKnownCards: noop, setFlashcardProgress: noop, setIsFlipped: noop, setHasUsedFreeRegen: noop,
    localStorage: { removeItem: noop }, sessionStorage: { setItem: noop }, crypto,
    setTimeout: (callback, delay) => { const id = ++timerId; state.timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => state.timers.delete(id),
  };
  const run = new Function(...Object.keys(env), js + '\nreturn handleRegenerate;')(...Object.values(env));
  return { state, run, finish: () => finishFetch() };
}
async function quizErrorAction(status, body) {
  const { state, run } = await loadRegenerationAction('QuizPage', { status, body });
  await run(); return state;
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
]) test('QuizPage: ' + status + '/' + body.error + ' remains a safe non-quota error', async () => {
  const result = await quizErrorAction(status, body);
  assert.deepEqual(result.alerts, [status === 503
    ? 'Usługa jest chwilowo niedostępna. Spróbuj ponownie za chwilę.'
    : 'Nie udało się wygenerować materiału. Spróbuj ponownie za chwilę.']);
  assert.deepEqual(result.busy, [true, false]);
});
for (const page of ['QuizPage', 'FlashcardsPage']) {
  for (const [label, options, message] of [
    ['network', { networkFailure: true }, 'Nie udało się połączyć z usługą. Sprawdź połączenie i spróbuj ponownie.'],
    ['body network', { bodyNetworkFailure: true }, 'Nie udało się połączyć z usługą. Sprawdź połączenie i spróbuj ponownie.'],
    ['fetch timeout', { fetchTimeout: true }, 'Generowanie trwało zbyt długo. Spróbuj ponownie za chwilę.'],
    ['body timeout', { bodyTimeout: true }, 'Generowanie trwało zbyt długo. Spróbuj ponownie za chwilę.'],
    ['backend timeout', { status: 504, body: { error: 'provider_timeout', message: 'PRIVATE_PROVIDER_MESSAGE' } }, 'Generowanie trwało zbyt długo. Spróbuj ponownie za chwilę.'],
    ['backend provider failure', { status: 502, body: { error: 'provider_error', message: 'PRIVATE_PROVIDER_MESSAGE' } }, 'Nie udało się wygenerować materiału. Spróbuj ponownie za chwilę.'],
    ['guard unavailable', { status: 503, body: { error: 'usage_guard_unavailable' } }, 'Usługa jest chwilowo niedostępna. Spróbuj ponownie za chwilę.'],
    ['quota', { status: 403, body: { error: 'usage_limit_reached', message: 'Osiągnięto limit.' } }, 'Osiągnięto limit.'],
  ]) test(page + ': ' + label + ' has safe UX and releases local guard', async () => {
    const { state, run } = await loadRegenerationAction(page, options);
    await run();
    assert.deepEqual(state.alerts, [message]);
    assert.deepEqual(state.busy, [true, false]);
    assert.equal(state.messages.at(-1), null);
    assert.equal(state.guard.current, false);
    assert.equal(state.fetches, 1);
    assert.equal(state.timers.size, 0);
    if (options.fetchTimeout || options.bodyTimeout) assert.equal(state.aborted, true);
    await run();
    assert.equal(state.fetches, 2, 'A subsequent explicit invocation works after failure');
  });
  test(page + ': two immediate invocations share one local in-flight operation; success clears it', async () => {
    const { state, run, finish } = await loadRegenerationAction(page, { pending: true });
    const first = run(); const duplicate = run();
    await Promise.resolve();
    assert.equal(state.fetches, 1);
    assert.deepEqual(state.busy, [true]);
    finish(); await Promise.all([first, duplicate]);
    assert.deepEqual(state.alerts, []);
    assert.deepEqual(state.busy, [true, false]);
    assert.equal(state.messages.at(-1), null);
    assert.equal(state.guard.current, false);
    assert.equal(state.timers.size, 0);
    const next = run(); await Promise.resolve(); finish(); await next;
    assert.equal(state.fetches, 2, 'Guard resets after success');
  });
}

for (const [label, options, expected] of [
  ['network', { network: true }, 'Nie udało się połączyć z usługą. Sprawdź połączenie i spróbuj ponownie.'],
  ['fetch deadline', { fetchTimeout: true }, 'Generowanie trwało zbyt długo. Spróbuj ponownie za chwilę.'],
  ['body deadline', { bodyTimeout: true }, 'Generowanie trwało zbyt długo. Spróbuj ponownie za chwilę.'],
  ['provider timeout', { status: 504, error: 'provider_timeout' }, 'Generowanie trwało zbyt długo. Spróbuj ponownie za chwilę.'],
  ['guard unavailable', { status: 503, error: 'usage_guard_unavailable' }, 'Usługa jest chwilowo niedostępna. Spróbuj ponownie za chwilę.'],
  ['provider failure', { status: 502, error: 'provider_error' }, 'Nie udało się wygenerować materiału. Spróbuj ponownie za chwilę.'],
  ['quota', { status: 403, error: 'usage_limit_reached', message: 'Osiągnięto limit.' }, 'usage_limit:Osiągnięto limit.'],
]) test('AnalysisPage: ' + label + ' has safe UX; 90s timer covers body', async () => {
  const text = (await source('src/pages/app/AnalysisPage.tsx')).replaceAll('\r\n', '\n');
  const start = text.indexOf('  useEffect(() => {\n    const sessionId');
  const end = text.indexOf('  }, [navigate]);', start);
  assert.ok(start >= 0 && end > start);
  const action = ('const effect = () => {' + text.slice(start + '  useEffect(() => {'.length, end) + '};')
    .replaceAll('import.meta.env.VITE_SUPABASE_URL', "'https://example.invalid'")
    .replaceAll('import.meta.env.VITE_SUPABASE_ANON_KEY', "'test-anon'");
  const js = ts.transpileModule(action, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  let complete;
  const done = new Promise(resolve => { complete = resolve; });
  const state = { message: null, timers: new Map(), fetches: 0, aborted: false };
  const waitForAbort = signal => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { state.aborted = true; reject(new DOMException('PRIVATE_ABORT', 'AbortError')); }, { once: true });
    queueMicrotask(() => {
      const timer = [...state.timers.values()].find(timer => timer.delay === 90000);
      assert.ok(timer); timer.callback();
    });
  });
  const env = {
    currentSessionId: sessionId, navigate() {}, t: key => key, console: { log() {}, warn() {}, error() {} },
    supabase: { auth: { async getSession() { return { data: { session: { access_token: 'test' } } }; } },
      from(table) { return { select() { return { eq() { return {
        async single() { return { data: { subject: null, image_url: null } }; },
        async order() { assert.equal(table, 'session_images'); return { data: [] }; },
      }; } }; } }; },
    },
    fetch: async (url, init) => {
      state.fetches++;
      if (options.network) throw new TypeError('PRIVATE_NETWORK_DETAILS');
      if (options.fetchTimeout) return waitForAbort(init.signal);
      if (options.bodyTimeout) return { ok: true, status: 200, text: () => waitForAbort(init.signal) };
      return new Response(JSON.stringify({ error: options.error, message: options.message ?? 'PRIVATE_PROVIDER_MESSAGE' }), { status: options.status });
    },
    setAnalysisError: message => { state.message = message; }, setIsLoading: value => { if (!value) complete(); },
    setTimeout: (callback, delay) => { state.timers.set(1, { callback, delay }); return 1; },
    clearTimeout: id => state.timers.delete(id),
  };
  new Function(...Object.keys(env), js + '\nreturn effect;')(...Object.values(env))();
  await done;
  assert.equal(state.message, expected);
  assert.equal(state.fetches, 1);
  assert.equal(state.timers.size, 0);
  if (options.fetchTimeout || options.bodyTimeout) assert.equal(state.aborted, true);
});

for (const status of [401, 429, 502]) {
  test(`regenerate: provider ${status} never exposes raw provider data`, async () => {
    const privateValues = ['PRIVATE_PROVIDER_MESSAGE', 'PRIVATE_PROMPT', 'PRIVATE_OCR', 'Authorization', 'Bearer test-config'];
    const { state, request } = await loadEndpoint('regenerate-module', {
      providerStatus: status, rawOpenAi: JSON.stringify({ error: {
        type: 'provider_failure', code: 'test_code', message: privateValues.join(' '),
      }, prompt: 'PRIVATE_PROMPT', ocr: 'PRIVATE_OCR' }),
    });
    const response = await request();
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'provider_error' });
    assertExactRelease(state);
    const diagnostics = state.logs.filter(args => args[0] === '[regenerate-module] OpenAI provider error');
    assert.equal(diagnostics.length, 1);
    assert.deepEqual(Object.keys(diagnostics[0][1]).sort(), ['code', 'requestId', 'status', 'type']);
    assert.equal(diagnostics[0][1].status, status);
    for (const value of privateValues) assert.ok(!JSON.stringify(state.logs).includes(value));
  });
}
test('regenerate: timing markers split provider/save/total and close failed requests', async () => {
  for (const failure of [false, true]) {
    const { state, request } = await loadEndpoint('regenerate-module', { providerTimeout: failure });
    await request();
    const markers = state.logs.filter(args => typeof args[0] === 'string' && args[0].startsWith('{'))
      .map(args => JSON.parse(args[0])).filter(entry => entry.marker === 'regenerate-module-timing');
    assert.deepEqual(markers.map(entry => entry.stage), failure
      ? ['request_start', 'provider_start', 'provider_done', 'request_done']
      : ['request_start', 'provider_start', 'provider_done', 'db_save_start', 'db_save_done', 'request_done']);
    assert.equal(new Set(markers.map(entry => entry.requestId)).size, 1);
    for (const marker of markers) {
      assert.equal(typeof marker.requestId, 'string');
      assert.ok(Number.isFinite(marker.elapsedMs));
      if (['provider_done', 'db_save_done'].includes(marker.stage)) assert.ok(Number.isFinite(marker.durationMs));
    }
    assert.equal(markers.at(-1).status, failure ? 'error' : 'success');
  }
});

for (const page of ['QuizPage', 'FlashcardsPage']) {
  test(page + ': actual completion state renders loader and no competing CTA', async () => {
    const code = (await source('src/pages/app/' + page + '.tsx')).replace(/^import .*;\r?\n/gm, '')
      .replace('export default function', 'function')
      .replaceAll('import.meta.env.VITE_SUPABASE_URL', "'https://example.invalid'")
      .replaceAll('import.meta.env.VITE_SUPABASE_ANON_KEY', "'test-anon'");
    const quiz = page === 'QuizPage';
    const states = quiz
      ? [[{ id: 'q' }], 0, [], null, false, true, 0, false, true, 'Generuję nowy quiz...', null, {}]
      : [[{ id: 'f' }], 1, false, new Set(), [], false, false, {}, false, true, 'Generuję nowe fiszki...'];
    let stateIndex = 0;
    const noop = () => {};
    const env = { React: { createElement }, useState: () => [states[stateIndex++], noop],
      useRef: value => ({ current: value }), useEffect: noop, useMemo: callback => callback(),
      useNavigate: () => noop, useParams: () => ({ id: sessionId }),
      useAuth: () => ({ user: {}, isDemoMode: false }), useTranslation: () => ({ t: key => key }),
      getEffectivePlan: () => 'premium', getFeatureAccess: () => ({ quizQuestionCount: 12, maxFlashcardsPerLesson: 20 }),
    };
    const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None, jsx: ts.JsxEmit.React } }).outputText;
    const component = new Function(...Object.keys(env), js + '\nreturn ' + page + ';')(...Object.values(env));
    const html = renderToStaticMarkup(component());
    assert.ok(html.includes('role="status"'));
    assert.ok(html.includes('animate-spin'));
    assert.ok(html.includes(quiz ? 'Generuję nowy quiz...' : 'Generuję nowe fiszki...'));
    assert.ok(!html.includes('<button') && !html.includes('<a '), 'Completion CTAs must not remain active');
  });
}
