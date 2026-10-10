import { assertArchivedMigrationsUnchanged } from './helpers/migration-provenance.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { getAiAccountDenial } from '../supabase/functions/_shared/account-access.ts';

// STATIC_CONTRACT checks SQL/source only. MOCKED_RUNTIME executes actual Edge
// handlers with caller/admin clients distinguished by key. Neither proves live RLS.
const userId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';
const reservationId = '44444444-4444-4444-8444-444444444444';
const names = ['analyze-notes', 'delete-session', 'delete-account'];
const sources = new Map(await Promise.all(names.map(async name => [name,
  await readFile(new URL(`../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8'),
])));
const migration = await readFile(new URL('../supabase/migration_archive/legacy_pre_baseline/00078_storage_ownership_hardening.sql', import.meta.url), 'utf8');
const migration79 = await readFile(new URL('../supabase/migration_archive/legacy_pre_baseline/00079_drop_legacy_reference_policy_variants.sql', import.meta.url), 'utf8');
const compiled = new Map([...sources].map(([name, source]) => [name, ts.transpileModule(
  source.replace(/^import .*;\r?\n/gm, ''),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
).outputText]));

function loadEndpoint(name, options = {}) {
  const state = { storage: [], clients: [], queries: [], order: [], cleanup: [], logs: [], providers: [] };
  const session = { id: sessionId, user_id: userId, image_url: options.path ?? `${userId}/session/a.jpg`,
    deleted_at: null, raw_ocr_text: null, subject: null, ...options.session };
  const result = (data = null) => ({ data, error: null });
  function query(table, operation, payload) {
    const record = { table, operation, payload, filters: [] };
    state.queries.push(record);
    const execute = () => {
      if (operation === 'select') {
        if (table === 'profiles') return result({ account_status: 'active' });
        if (table === 'study_sessions') {
          if (name === 'delete-account') {
            assert.deepEqual(record.filters, [['eq', 'user_id', userId]]);
            return result(options.sessions ?? [session]);
          }
          assert.deepEqual(record.filters, name === 'analyze-notes'
            ? [['eq', 'id', sessionId], ['eq', 'user_id', userId], ['is', 'deleted_at', null]]
            : [['eq', 'id', sessionId]]);
          return result(name === 'analyze-notes' && (session.user_id !== userId || session.deleted_at !== null) ? null : session);
        }
        if (table === 'session_images') {
          assert.deepEqual(record.filters, name === 'delete-account'
            ? [['in', 'session_id', (options.sessions ?? [session]).map(s => s.id)]]
            : [['eq', 'session_id', sessionId]]);
          return result((options.images ?? []).map(image_url => ({ image_url })));
        }
        assert.fail(`Unexpected select: ${table}`);
      }
      if (table === 'usage_events') {
        assert.equal(operation, 'delete');
        assert.deepEqual(record.filters, [['eq', 'id', reservationId], ['eq', 'user_id', userId]]);
        state.cleanup.push(record.filters);
      }
      state.order.push(`${operation}:${table}`);
      if (table === 'study_sessions' && operation === 'update' && name === 'analyze-notes') {
        assert.deepEqual(record.filters, [['eq', 'id', sessionId], ['eq', 'user_id', userId], ['is', 'deleted_at', null]]);
        return result({ id: sessionId });
      }
      return result();
    };
    const builder = {
      eq(column, value) { record.filters.push(['eq', column, value]); return builder; },
      is(column, value) { record.filters.push(['is', column, value]); return builder; },
      select(columns) { assert.equal(columns, 'id'); return builder; },
      in(column, value) { record.filters.push(['in', column, value]); return builder; },
      order() { return builder; },
      single: async () => execute(), maybeSingle: async () => execute(),
      then(resolve, reject) { return Promise.resolve().then(execute).then(resolve, reject); },
    };
    return builder;
  }
  const createClient = (url, key, config) => {
    state.clients.push({ key, config });
    const privileged = key === 'test-service';
    return {
      auth: {
        async getUser() { return options.authError ? { data: { user: null }, error: {} }
          : result({ user: { id: userId } }); },
        admin: { async deleteUser(id) {
          assert.ok(privileged); assert.equal(id, userId);
          state.order.push('auth-delete'); return result();
        } },
      },
      async rpc(fn) {
        if (fn === 'get_my_effective_plan') return result({ effective_plan: 'free' });
        assert.ok(privileged); assert.equal(fn, 'check_and_reserve_ai_usage');
        return result({ allowed: true, reservation_id: reservationId });
      },
      from(table) { return {
        select: columns => query(table, 'select', columns),
        delete: () => query(table, 'delete'),
        update: payload => query(table, 'update', payload),
      }; },
      get storage() {
        assert.ok(!privileged, 'User-controlled paths must never use service-role Storage');
        assert.equal(key, 'test-anon');
        assert.equal(config.global.headers.Authorization, 'Bearer test-caller');
        return { from(bucket) {
          assert.equal(bucket, 'study-materials');
          return {
            async download(path) {
              state.storage.push({ action: 'download', paths: [path] });
              state.order.push('storage');
              return options.rlsDenied ? { data: null, error: { message: 'simulated RLS denial' } }
                : result(new Blob(['image']));
            },
            async remove(paths) {
              state.storage.push({ action: 'remove', paths }); state.order.push('storage');
              return options.rlsDenied ? { data: null, error: { message: 'simulated RLS denial' } } : result([]);
            },
          };
        } };
      },
    };
  };
  let handler;
  const boot = new Function('serve', 'createClient', 'getAiAccountDenial', 'createRemoteJWKSet', 'jwtVerify',
    'Deno', 'fetch', 'console', 'crypto', 'performance', compiled.get(name) + '\nreturn isValidStudyMaterialPath;');
  const validate = boot(fn => { handler = fn; }, createClient, getAiAccountDenial, () => ({}), async () => {
    if (options.authError) throw new Error('invalid JWT');
    return { payload: { sub: userId } };
  }, { env: { get(key) {
    if (key === 'SUPABASE_URL') return 'https://test.invalid';
    if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-service';
    if (key === 'SUPABASE_ANON_KEY') return 'test-anon';
    return 'test-config';
  } } }, async url => {
    state.providers.push(url.includes('vision.googleapis.com') ? 'vision' : 'openai');
    const generation = { subject: 'Biology', topic: 'Cells', summary: 'Summary', keyConcepts: [],
      flashcards: [{ front: 'Question', back: 'Answer', difficulty: 'easy' }],
      quizQuestions: [{ question: 'Question', options: ['A', 'B', 'C', 'D'], correctIndex: 0 }] };
    return new Response(JSON.stringify(url.includes('vision.googleapis.com')
      ? { responses: [{ fullTextAnnotation: { text: 'OCR text' } }] }
      : { choices: [{ message: { content: JSON.stringify(generation) } }] }), { status: 200 });
  }, Object.fromEntries(['log', 'warn', 'error', 'info'].map(level => [level,
    (...args) => state.logs.push({ level, args })])), crypto, performance);
  return { state, validate, async request(authorized = true) {
    return handler(new Request('https://test.invalid/function', { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: 'Bearer test-caller' } : {}) },
      body: JSON.stringify({ sessionId, userId: otherId }),
    }));
  } };
}

for (const name of names) {
  const { validate } = loadEndpoint(name);
  for (const [label, path, allowed] of [
    ['own current', `${userId}/session/a.jpg`, true], ['foreign current', `${otherId}/session/a.jpg`, false],
    ['legacy namespace', 'uploads/a.pdf', true], ['unicode and spaces', 'uploads/notatki ą (1).pdf', true],
    ['opaque percent encoding', 'uploads/a%2Fb.pdf', true], ['hidden object', 'uploads/.hidden', true],
    ['empty', '', false], ['whitespace', '   ', false], ['leading slash', '/uploads/a.pdf', false],
    ['dot root', '../a.pdf', false], ['dot segment', 'uploads/./a.pdf', false],
    ['parent segment', 'uploads/../a.pdf', false], ['empty segment', 'uploads//a.pdf', false],
    ['https URL', 'https://example.com/a.pdf', false], ['http URL', 'http://example.com/a.pdf', false],
    ['unknown namespace', 'other/a.pdf', false], ['backslash', '\\uploads\\a.pdf', false],
    ['leading whitespace', '  uploads/a.pdf', false], ['trailing whitespace', 'uploads/a.pdf  ', false],
    ['trailing slash', 'uploads/a.pdf/', false], ['no object', 'uploads/', false],
    ['root alone', userId, false], ['null', null, false], ['undefined', undefined, false],
    ['number', 10, false], ['object', {}, false], ['array', ['uploads/a.pdf'], false],
  ]) test(`MOCKED_RUNTIME ${name}: validator ${label}`, () => assert.equal(validate(path, userId), allowed));

  test(`STATIC_CONTRACT ${name}: caller Storage only, original JWT, no privileged fallback`, () => {
    const source = sources.get(name);
    assert.match(source, /userClient\.storage\s*\.from\('study-materials'\)/);
    assert.doesNotMatch(source, /adminClient\.storage|createSignedUrl|getPublicUrl|\.storage\.list/);
    assert.match(source, /SUPABASE_ANON_KEY/);
    assert.match(source, /global:\s*\{\s*headers:\s*\{\s*Authorization:\s*authHeader/);
  });
  for (const [label, authorized, options] of [['missing auth', false, {}], ['invalid auth', true, { authError: true }]]) {
    test(`MOCKED_RUNTIME ${name}: ${label} => 401, no Storage`, async () => {
      const { request, state } = loadEndpoint(name, options);
      assert.equal((await request(authorized)).status, 401); assert.deepEqual(state.storage, []);
    });
  }
  for (const path of [`${userId}/session/a.jpg`, 'uploads/a.pdf']) {
    test(`MOCKED_RUNTIME ${name}: accepted path uses only caller Storage`, async () => {
      const { request, state } = loadEndpoint(name, { path });
      assert.equal((await request()).status, 200);
      assert.deepEqual(state.storage, [{ action: name === 'analyze-notes' ? 'download' : 'remove', paths: [path] }]);
      assert.equal(state.cleanup.length, 0);
    });
  }
  test(`MOCKED_RUNTIME ${name}: foreign modern path never reaches Storage`, async () => {
    const { request, state } = loadEndpoint(name, { path: `${otherId}/session/a.jpg` });
    assert.equal((await request()).status, name === 'analyze-notes' ? 400 : 200);
    assert.deepEqual(state.storage, []); assert.deepEqual(state.providers, []);
    if (name === 'analyze-notes') assert.equal(state.cleanup.length, 1);
    assert.ok(state.logs.some(log => log.level === 'warn' && /Unsafe material path/.test(log.args[0])));
    assert.ok(!state.logs.some(log => JSON.stringify(log).includes(`${otherId}/session/a.jpg`)));
  });
  test(`MOCKED_RUNTIME ${name}: foreign legacy simulated RLS denial never retries`, async () => {
    const { request, state } = loadEndpoint(name, { path: 'uploads/victim.pdf', rlsDenied: true });
    assert.equal((await request()).status, name === 'analyze-notes' ? 500 : 200);
    assert.equal(state.storage.length, 1);
    assert.deepEqual(state.providers, []);
    if (name === 'analyze-notes') assert.equal(state.cleanup.length, 1);
  });
  test(`MOCKED_RUNTIME ${name}: unsafe session_images reference never reaches Storage`, async () => {
    const { request, state } = loadEndpoint(name, { images: [`${otherId}/unsafe.jpg`] });
    assert.equal((await request()).status, name === 'analyze-notes' ? 400 : 200);
    assert.ok(state.storage.every(call => call.paths.every(path => path.startsWith(`${userId}/`))));
    if (name === 'analyze-notes') assert.deepEqual(state.storage, []);
  });
}

for (const name of ['analyze-notes', 'delete-session']) {
  test(`MOCKED_RUNTIME ${name}: wrong-owner session is denied before Storage`, async () => {
    const { request, state } = loadEndpoint(name, { session: { user_id: otherId } });
    assert.equal((await request()).status, name === 'analyze-notes' ? 404 : 403); assert.deepEqual(state.storage, []);
  });
}
for (const name of ['delete-session', 'delete-account']) {
  test(`MOCKED_RUNTIME ${name}: deduplicates primary/child paths; retains safe children`, async () => {
    const path = `${userId}/session/a.jpg`;
    const { request, state } = loadEndpoint(name, { path, images: [path, 'uploads/child.pdf', `${otherId}/foreign.pdf`] });
    assert.equal((await request()).status, 200);
    assert.deepEqual(state.storage, [{ action: 'remove', paths: [path, 'uploads/child.pdf'] }]);
  });
}
for (const rlsDenied of [false, true]) {
  test(`MOCKED_RUNTIME delete-account: Storage precedes Auth deletion (denial=${rlsDenied}); caller ID wins`, async () => {
    const { request, state } = loadEndpoint('delete-account', { rlsDenied });
    assert.equal((await request()).status, 200);
    assert.ok(state.order.indexOf('storage') < state.order.indexOf('auth-delete'));
    assert.deepEqual(state.queries.find(q => q.table === 'study_sessions' && q.operation === 'delete').filters,
      [['eq', 'user_id', userId]]);
  });
}

test('STATIC_CONTRACT 00078: transaction, exact vulnerable policy replaced by two owner-based policies', () => {
  assert.match(migration, /^BEGIN;/); assert.match(migration, /COMMIT;\s*$/);
  assert.match(migration, /DROP POLICY IF EXISTS "study_materials_select_legacy_owned_reference"\s+ON storage\.objects/);
  const policies = [...migration.matchAll(/CREATE POLICY "([^"]+)"\s+ON storage\.objects\s+FOR (\w+) TO (\w+)\s+USING \(([^;]+)\);/g)];
  assert.deepEqual(policies.map(p => [p[1], p[2], p[3]]), [
    ['study_materials_select_legacy_owned', 'SELECT', 'authenticated'],
    ['study_materials_delete_legacy_owned', 'DELETE', 'authenticated'],
  ]);
  for (const policy of policies) {
    assert.match(policy[4], /bucket_id = 'study-materials'/);
    assert.match(policy[4], /name LIKE 'uploads\/%'/);
    assert.match(policy[4], /owner_id = auth\.uid\(\)::text/);
  }
});
test('STATIC_CONTRACT 00078: no legacy INSERT/UPDATE, data writes, or modern policy changes', () => {
  assert.doesNotMatch(migration, /FOR (?:INSERT|UPDATE|ALL)\b/);
  assert.doesNotMatch(migration, /\b(?:UPDATE|INSERT INTO|DELETE FROM)\s+(?:public\.)?(?:study_sessions|session_images|storage\.objects)\b/i);
  for (const action of ['insert', 'select', 'update', 'delete']) {
    assert.ok(!migration.includes(`study_materials_${action}_own_folder`));
  }
});
test('STATIC_CONTRACT 00078: fail-closed pg_policies checks cover names, roles, commands and ownership expression', () => {
  const check = migration.slice(migration.indexOf('DO $policy_check$'));
  assert.match(check, /SELECT count\(\*\) FROM pg_policies/);
  assert.match(check, /roles = ARRAY\['authenticated'\]::name\[\]/);
  assert.match(check, /cmd = 'SELECT'/); assert.match(check, /cmd = 'DELETE'/);
  for (const token of ['bucket_id', 'study-materials', 'uploads/%', 'owner_id', 'auth.uid()']) {
    assert.ok(check.includes(`position('${token}' IN qual)`));
  }
  assert.equal([...check.matchAll(/RAISE EXCEPTION/g)].length, 3);
  assert.match(check, /cmd IN \('INSERT', 'UPDATE', 'ALL'\)/);
  assert.match(check, /END;\s*\$policy_check\$;/);
});
test('STATIC_CONTRACT: historical migrations 00001–00077 unchanged', () => {
  assertArchivedMigrationsUnchanged(77);
});
test('STATIC_CONTRACT 00079: dynamic drop of legacy policy variants', () => {
  assert.match(migration79, /^BEGIN;/); assert.match(migration79, /COMMIT;\s*$/);
  // Verify 00078 exact-name DROP is not enough.
  assert.doesNotMatch(migration79, /DROP POLICY IF EXISTS "study_materials_select_legacy_owned_reference"\s+ON/);
  // Verify 00079 uses dynamic DROP matching variants.
  assert.match(migration79, /policyname LIKE 'study_materials_select_legacy_owned_reference%'/);
  assert.match(migration79, /EXECUTE format\('DROP POLICY IF EXISTS %I ON storage.objects', \w+\.policyname\);/);
});

test('STATIC_CONTRACT 00079: fail-closed verification ensures no variants remain and safe policies are preserved', () => {
  const check = migration79.slice(migration79.indexOf('DO $policy_check$'));
  assert.match(check, /policyname LIKE 'study_materials_select_legacy_owned_reference%'/);
  assert.match(check, /RAISE EXCEPTION 'Unsafe legacy Storage policy variant remains'/);
  
  assert.match(check, /policyname = 'study_materials_select_legacy_owned'/);
  assert.match(check, /cmd = 'SELECT'/);
  assert.match(check, /RAISE EXCEPTION 'Missing safe SELECT policy'/);
  
  assert.match(check, /policyname = 'study_materials_delete_legacy_owned'/);
  assert.match(check, /cmd = 'DELETE'/);
  assert.match(check, /RAISE EXCEPTION 'Missing safe DELETE policy'/);
  
  assert.match(check, /cmd IN \('INSERT', 'UPDATE', 'ALL'\)/);
  assert.match(check, /RAISE EXCEPTION 'Unexpected legacy Storage write policy'/);
  assert.match(check, /END;\s*\$policy_check\$;/);
});

test('STATIC_CONTRACT 00079: no data backfill/write exists and 00078 remains untouched', () => {
  assert.doesNotMatch(migration79, /\b(?:UPDATE|INSERT INTO|DELETE FROM)\s+(?:public\.)?(?:study_sessions|session_images|storage\.objects)\b/i);
  assert.doesNotMatch(migration79, /CREATE POLICY/); // 00079 only drops and checks
});
