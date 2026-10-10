import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const userId = '11111111-1111-4111-8111-111111111111';
const sessionId = '33333333-3333-4333-8333-333333333333';

const source = await readFile(new URL('../supabase/functions/delete-session/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(
  source.replace(/^import .*;\r?\n/gm, ''),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
).outputText.replace(/error:\s*['"]Internal server error['"]/, "error: String(error) + '\\n' + error.stack");

function loadEndpoint(options = {}) {
  const state = { order: [], calls: {}, storageRemoved: [], storageVerifiedFiles: [], isServiceRole: false };
  const result = (data = null) => ({ data, error: null });
  function track(type) { state.order.push(type); state.calls[type] = (state.calls[type] || 0) + 1; }

  const createClient = (url, key) => {
    state.isServiceRole = (key === 'test-service-key');
    return {
      auth: { async getUser(token) { return options.authError ? { error: {} } : result({ user: { id: userId } }); } },
      rpc: async (fn, params) => {
        track('rpc:' + fn);
        if (fn === 'begin_session_purge') return options.purgeError ? { error: {} } : result({ started: !options.alreadyStarted, already_started: options.alreadyStarted });
        if (fn === 'get_storage_object_owner') return options.ownerVerifyError ? { error: {} } : result(options.legacyAbsent ? [] : [{ owner_id: options.legacyOwnerMismatch ? '999' : (options.legacyOwnerNull ? null : userId) }]);
        return result();
      },
      from: (table) => ({
        select: (cols) => ({
          in: () => ({ neq: () => ({ limit: () => Promise.resolve(table === 'study_sessions' ? (options.sharedRoots ? result([{id: 'x'}]) : result([])) : (options.sharedImages ? result([{session_id: 'x'}]) : result([]))) }) }),
          eq: () => ({
             maybeSingle: async () => options.dbError ? { error: {} } : (options.rootAbsent ? result(null) : result({ id: sessionId, user_id: options.foreignSession ? '999' : userId, deleted_at: null })),
             range: (from) => Promise.resolve(from === 0 && table === 'session_images' && (options.images || options.legacyImages) ? result((options.images || ['uploads/legacy.jpg']).map(image_url => ({ image_url }))) : result([])),
             single: async () => options.dbError || options.rootInventoryError ? { error: {} } : (options.rootAbsent ? { error: {} } : result({ id: sessionId, user_id: options.foreignSession ? '999' : userId, deleted_at: null, image_url: options.rootImageUrl ?? null }))
          }),
        }),
        delete: () => ({ eq: () => ({ eq: () => ({ not: () => { track('db:delete:study_sessions'); return options.dbDeleteError ? { error: {} } : result(); } }) }) })
      }),
      storage: { from: () => ({
        list: async (prefix, opts) => {
          track('storage:list');
          if (options.storageInventoryError && opts?.limit === 100
            || options.storageVerifyError && opts?.limit === 1
            || options.storageLegacyVerifyError && opts?.search) return { data: null, error: {} };
          if (opts?.search) { state.storageVerifiedFiles.push(opts.search); return options.storageVerifyFailLegacy ? result([{name: opts.search}]) : result([]); }
          if (opts?.limit === 1) return options.storageVerifyFail ? result([{name: 'file'}]) : result([]);
          return options.inventoryFiles && opts?.offset === 0 ? result(options.inventoryFiles) : result([]);
        },
        remove: async (paths) => { track('storage:remove'); state.storageRemoved.push(...paths); return options.storageRemoveError ? { error: {} } : result(); }
      }) }
    };
  };

  const execute = new Function('req', 'Deno', 'createClient', 'supabaseUrl', 'jwtVerify', 'JWKS', 'createRemoteJWKSet', 'let handler; const serve = (h) => { handler = h; };\n' + compiled + '\nreturn handler(req).catch(e => { console.error("MOCK ERROR:", e); return new Response("500", {status:500}); });');
  return { request: (authorized = true) => execute({ method: 'POST', headers: new Headers(authorized ? { Authorization: 'Bearer test' } : {}), json: async () => ({ sessionId: options.invalidUuid ? 'abc' : sessionId }) }, { env: { get: (k) => k === 'SUPABASE_URL' ? 'https://test.supabase.co' : 'test-service-key' } }, createClient, 'https://test.supabase.co', async () => { if (options.authError) throw new Error('bad jwt'); return { payload: { sub: userId } }; }, {}, () => {}), state };
}

test('BEHAVIORAL: active session flow', async () => {
  const { request, state } = loadEndpoint({ inventoryFiles: [{name: 'a.pdf'}] });
  const res = await request();
  if (res.status !== 200) console.log(await res.text());
  assert.equal(res.status, 200);
  assert.equal(state.calls['rpc:begin_session_purge'], 1);
  assert.equal(state.calls['storage:remove'], 1);
  assert.equal(state.calls['db:delete:study_sessions'], 1);
});

test('BEHAVIORAL: already_started continues cleanup', async () => {
  const { request, state } = loadEndpoint({ alreadyStarted: true });
  const res = await request();
  assert.equal(res.status, 200);
  assert.equal(state.calls['storage:list'] > 0, true);
  assert.equal(state.calls['db:delete:study_sessions'], 1);
});

test('BEHAVIORAL: Storage inventory/remove failure NO DB delete', async () => {
  for (const failure of [{ storageRemoveError: true }, { storageInventoryError: true }]) {
    const { request, state } = loadEndpoint({ inventoryFiles: [{name: 'a'}], ...failure });
    assert.equal((await request()).status, 500);
    assert.equal(state.calls['db:delete:study_sessions'], undefined);
    if (failure.storageInventoryError) assert.equal(state.calls['storage:remove'], undefined);
  }
});

test('BEHAVIORAL: Storage verification failure NO DB delete', async () => {
  for (const failure of [{ storageVerifyFail: true }, { storageVerifyError: true }]) {
    const { request, state } = loadEndpoint(failure);
    assert.equal((await request()).status, 500);
    assert.equal(state.calls['db:delete:study_sessions'], undefined);
  }
});

test('BEHAVIORAL: shared object NO Storage remove', async () => {
  const { request, state } = loadEndpoint({ inventoryFiles: [{name: 'a'}], sharedRoots: true });
  assert.equal((await request()).status, 409);
  assert.equal(state.calls['storage:remove'], undefined);
});

test('BEHAVIORAL: legacy owner mismatch NO Storage remove', async () => {
  const { request, state } = loadEndpoint({ legacyImages: true, legacyOwnerMismatch: true });
  const res = await request();
  assert.equal(res.status, 409);
  assert.equal(state.calls['rpc:get_storage_object_owner'], 1);
  assert.equal(state.calls['storage:remove'], undefined);
});

test('BEHAVIORAL: legacy owner NULL NO Storage remove', async () => {
  const { request, state } = loadEndpoint({ legacyImages: true, legacyOwnerNull: true });
  const res = await request();
  assert.equal(res.status, 409);
  assert.equal(state.calls['storage:remove'], undefined);
});

test('BEHAVIORAL: legacy owner match Storage remove called', async () => {
  const { request, state } = loadEndpoint({ legacyImages: true });
  const res = await request();
  assert.equal(res.status, 200);
  assert.equal(state.calls['rpc:get_storage_object_owner'], 1);
  assert.equal(state.calls['storage:remove'], 1);
});

test('BEHAVIORAL: root already absent idempotent', async () => {
  const { request, state } = loadEndpoint({ rootAbsent: true });
  const res = await request();
  assert.equal(res.status, 200);
  assert.equal(state.calls['rpc:begin_session_purge'], undefined);
});

test('BEHAVIORAL: foreign session NO begin purge', async () => {
  const { request, state } = loadEndpoint({ foreignSession: true });
  const res = await request();
  assert.equal(res.status, 403);
  assert.equal(state.calls['rpc:begin_session_purge'], undefined);
});

test('BEHAVIORAL: DB lookup error 5xx', async () => {
  for (const failure of [{ dbError: true }, { rootInventoryError: true }]) {
    const { request, state } = loadEndpoint(failure);
    assert.equal((await request()).status, 500);
    assert.equal(state.calls['storage:remove'], undefined);
    assert.equal(state.calls['db:delete:study_sessions'], undefined);
  }
});

test('BEHAVIORAL: DB delete failure retryable', async () => {
  const { request } = loadEndpoint({ dbDeleteError: true });
  assert.equal((await request()).status, 500);
});

test('BEHAVIORAL: repeated request after partial cleanup safe retry', async () => {
  for (const failure of [{ storageVerifyFailLegacy: true }, { storageLegacyVerifyError: true }]) {
    const { request, state } = loadEndpoint({ legacyImages: true, ...failure });
    const res = await request();
    assert.equal(res.status, 500); // verify failed
    assert.equal(state.storageRemoved.includes('uploads/legacy.jpg'), true);
    assert.equal(state.calls['db:delete:study_sessions'], undefined);
  }
});

test('BEHAVIORAL: service-role client used exactly', async () => {
  const { request, state } = loadEndpoint();
  await request();
  assert.equal(state.isServiceRole, true);
});

// ---- 36-case security mapping (replaces delete-session cases removed from f04) ----
const fnSource = source.match(/function isValidStudyMaterialPath[\s\S]*?\r?\n\}\r?\n/)[0];
const validate = new Function(ts.transpileModule(fnSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + '\nreturn isValidStudyMaterialPath;')();
const otherId = '22222222-2222-4222-8222-222222222222';
for (const [label, path, allowed] of [
  ['own current', userId + '/session/a.jpg', true], ['foreign current', otherId + '/session/a.jpg', false],
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
]) test('MAPPED f04 delete-session: validator ' + label, () => assert.equal(validate(path, userId), allowed));

test('MAPPED f04 delete-session: service-role Storage only after validation (static)', () => {
  assert.match(source, /adminClient\.storage/);
  assert.match(source, /isValidStudyMaterialPath\(p, userId\)/);
  assert.ok(source.indexOf('isValidStudyMaterialPath(p, userId)') < source.indexOf('.remove(batch)'));
  assert.doesNotMatch(source, /createSignedUrl|getPublicUrl/);
});

for (const [label, authorized, options] of [['missing auth', false, {}], ['invalid auth', true, { authError: true }]]) {
  test('MAPPED f04 delete-session: ' + label + ' => 401, no Storage', async () => {
    const { request, state } = loadEndpoint({ ...options, inventoryFiles: [{ name: 'a' }] });
    assert.equal((await request(authorized)).status, 401);
    assert.equal(state.calls['storage:remove'], undefined);
    assert.equal(state.calls['storage:list'], undefined);
    assert.equal(state.calls['rpc:begin_session_purge'], undefined);
  });
}

for (const path of [userId + '/session/a.jpg', 'uploads/a.pdf']) {
  test('MAPPED f04 delete-session: accepted path ' + path.split('/')[0].slice(0, 8) + ' removed via Storage', async () => {
    const { request, state } = loadEndpoint({ rootImageUrl: path });
    assert.equal((await request()).status, 200);
    assert.deepEqual(state.storageRemoved, [path]);
  });
}

test('MAPPED f04 delete-session: foreign modern path never reaches Storage remove', async () => {
  const { request, state } = loadEndpoint({ rootImageUrl: otherId + '/session/a.jpg' });
  assert.equal((await request()).status, 409);
  assert.equal(state.calls['storage:remove'], undefined);
  assert.equal(state.calls['db:delete:study_sessions'], undefined);
});

test('MAPPED f04 delete-session: foreign legacy object (owner differs) never removed, no retry', async () => {
  const { request, state } = loadEndpoint({ rootImageUrl: 'uploads/victim.pdf', legacyOwnerMismatch: true });
  assert.equal((await request()).status, 409);
  assert.equal(state.calls['rpc:get_storage_object_owner'], 1);
  assert.equal(state.calls['storage:remove'], undefined);
});

test('MAPPED f04 delete-session: unsafe session_images reference never reaches Storage', async () => {
  const { request, state } = loadEndpoint({ images: [otherId + '/unsafe.jpg'] });
  assert.equal((await request()).status, 409);
  assert.equal(state.calls['storage:remove'], undefined);
  assert.equal(state.calls['db:delete:study_sessions'], undefined);
});

test('MAPPED f04 delete-session: wrong-owner session denied before Storage', async () => {
  const { request, state } = loadEndpoint({ foreignSession: true, rootImageUrl: 'uploads/a.pdf' });
  assert.equal((await request()).status, 403);
  assert.equal(state.calls['storage:list'], undefined);
  assert.equal(state.calls['storage:remove'], undefined);
});

test('MAPPED f04 delete-session: duplicate primary/child paths deduplicated', async () => {
  const path = userId + '/session/a.jpg';
  const { request, state } = loadEndpoint({ rootImageUrl: path, images: [path, 'uploads/child.pdf'] });
  assert.equal((await request()).status, 200);
  assert.deepEqual(state.storageRemoved.sort(), [path, 'uploads/child.pdf'].sort());
});
