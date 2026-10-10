import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { normalizationContract } from './helpers/migration-provenance.mjs';

// STATIC_CONTRACT + SPECIFICATION_MODEL only, not PostgreSQL/Storage runtime.
// STORAGE_CONCURRENCY_RUNTIME_PROOF=NOT_YET_RUN
// Deferred: issued signed URLs, mid-stream abort and cross-tab session invalidation.
const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8').replace(/\r\n/g, '\n');
const migrationFile = '20261010131220_priv02_session_deletion_barrier.sql';
const sql = read('supabase/migrations/' + migrationFile);
const baseline = read('supabase/migrations/' + normalizationContract.baseline_file);
const upload = read('src/pages/app/UploadPage.tsx');
const clean = sql.replace(/--[^\n]*/g, '');
const body = name => {
  const match = sql.match(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\([^]*?AS \\$function\\$([^]*?)\\$function\\$;`));
  assert.ok(match, name);
  return match[1];
};
const before = name => baseline.match(new RegExp(`-- BEGIN CANONICAL FUNCTION ${name}\\n([^]*?)\\n-- END CANONICAL FUNCTION ${name}`))[1];

test('STATIC_CONTRACT barrier changes only reviewed functions, ACL and restrictive policies', () => {
  assert.ok(clean.trim().startsWith('BEGIN;'));
  assert.ok(clean.trim().endsWith('COMMIT;'));
  assert.equal((clean.match(/CREATE (?:OR REPLACE )?FUNCTION /g) ?? []).length, 6);
  assert.equal((clean.match(/CREATE POLICY /g) ?? []).length, 4);
  assert.doesNotMatch(clean, /\b(?:DROP|TRUNCATE|DELETE FROM|CREATE TABLE|CREATE TRIGGER|ALTER TABLE|ALTER POLICY)\b/i);
  assert.doesNotMatch(clean, /\b(?:GRANT|REVOKE)[^;]*\bON (?:TABLE|SCHEMA)\b/i);
  assert.doesNotMatch(clean, /storage\.objects\s+(?:SET|VALUES)|INSERT INTO storage\.|auth\.users|cron\.|vault\./i);
  assert.doesNotMatch(sql, /eyJ[A-Za-z0-9_-]{12,}\.|sk_(?:live|test)_|https?:\/\//);
  assert.match(sql, /Signed URLs already issued are not revoked/);
});

test('STATIC_CONTRACT accepted baseline, P and delete-session are unchanged', () => {
  assert.equal(execFileSync('git', ['diff', '--name-only', 'HEAD', '--',
    'supabase/migrations/' + normalizationContract.baseline_file,
    'supabase/migrations/' + normalizationContract.priv02_file,
    'supabase/functions/delete-session/index.ts', 'package.json', 'package-lock.json'],
  { cwd: root, encoding: 'utf8' }).trim(), '');
});

test('STATIC_CONTRACT canonical path parser validates auth and both UUID segments before casts', () => {
  const p = body('session_material_session_id');
  assert.match(p, /v_user_id uuid := auth\.uid\(\)/);
  assert.match(p, /array_length\(v_parts, 1\) < 3/);
  for (const i of [1, 2]) {
    assert.ok(p.indexOf(`v_parts[${i}] !~*`) < p.indexOf(`v_parts[${i}]::uuid`));
  }
  assert.match(p, /v_parts\[1\]::uuid <> v_user_id/);
  assert.match(p, /v_parts\[2\] <> \(v_parts\[2\]::uuid\)::text/);
  assert.match(p, /part IN \('', '\.', '\.\.'\)/);
  assert.match(p, /RETURN NULL/);
});

test('STATIC_CONTRACT one deterministic key strategy shared by write and purge; hash never authorizes', () => {
  assert.match(body('session_mutation_lock_key'), /hashtextextended\('omninauka:session-mutation:' \|\| p_session_id::text, 0\)/);
  for (const [name, arg] of [['can_write_session_material', 'v_session_id'], ['begin_session_purge', 'p_session_id']]) {
    assert.match(body(name), new RegExp(`pg_advisory_xact_lock\\(public\\.session_mutation_lock_key\\(${arg}\\)\\)`));
    assert.match(body(name), /user_id|v_owner/);
  }
  assert.doesNotMatch(sql, /pg_advisory_lock\(/); // no session-scoped lock leaks
});

test('STATIC_CONTRACT write checks ownership before lock and active ownership again after lock', () => {
  const w = body('can_write_session_material');
  const lock = w.indexOf('pg_advisory_xact_lock');
  assert.match(w.slice(0, lock), /id = v_session_id AND user_id = v_user_id/);
  assert.match(w.slice(lock), /id = v_session_id AND user_id = v_user_id AND deleted_at IS NULL FOR SHARE/);
  assert.match(sql, /can_write_session_material\(p_name text\)[^]*?VOLATILE SECURITY DEFINER\nSET search_path = pg_catalog/);
});

test('STATIC_CONTRACT restrictive INSERT and both UPDATE predicates require the lock guard', () => {
  const insert = clean.match(/CREATE POLICY priv02_session_material_insert[^]*?;/)[0];
  const update = clean.match(/CREATE POLICY priv02_session_material_update[^]*?;/)[0];
  assert.match(insert, /AS RESTRICTIVE FOR INSERT TO authenticated/);
  assert.match(insert, /WITH CHECK \(bucket_id <> 'study-materials' OR public\.can_write_session_material\(name\)\)/);
  assert.match(update, /AS RESTRICTIVE FOR UPDATE TO authenticated/);
  assert.equal((update.match(/can_write_session_material\(name\)/g) ?? []).length, 2);
  // uploads/... and user/uploads/... cannot pass the mandatory UUID parser.
  assert.match(body('can_write_session_material'), /v_session_id uuid := public\.session_material_session_id\(p_name\)/);
  assert.match(body('can_write_session_material'), /IF v_session_id IS NULL/);
});

test('STATIC_CONTRACT later session_images attachment locks the exact matching active parent', () => {
  assert.match(clean, /CREATE POLICY priv02_session_image_attachment ON public\.session_images AS RESTRICTIVE FOR INSERT TO authenticated\s+WITH CHECK \(public\.session_material_session_id\(image_url\) = session_id\s+AND public\.can_write_session_material\(image_url\)\)/);
});

test('STATIC_CONTRACT SELECT narrows all permissive variants; deleted modern namespace is denied', () => {
  assert.match(clean, /CREATE POLICY priv02_session_material_read ON storage\.objects AS RESTRICTIVE FOR SELECT TO authenticated/);
  assert.match(body('can_read_session_material'), /id = v_session_id AND user_id = v_user_id AND deleted_at IS NULL/);
  assert.doesNotMatch(body('can_read_session_material'), /advisory/);
});

test('STATIC_CONTRACT legacy read needs exact reference from active owned root or image', () => {
  const r = body('can_read_session_material');
  assert.match(r, /p_name LIKE 'uploads\/%'/);
  assert.match(r, /p_name LIKE v_user_id::text \|\| '\/uploads\/%'/);
  assert.match(r, /s\.user_id = v_user_id AND s\.deleted_at IS NULL/);
  assert.match(r, /s\.image_url = p_name/);
  assert.match(r, /i\.session_id = s\.id AND i\.image_url = p_name/);
  assert.doesNotMatch(clean, /DROP POLICY|ALTER POLICY|CREATE POLICY[^;]*FOR DELETE/);
  assert.match(baseline, /owner_id = \(auth\.uid\(\)\)::text/); // permissive ownership remains
});

test('STATIC_CONTRACT begin purge is service-only, qualified, rechecks owner, never deletes root', () => {
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.begin_session_purge\(uuid, uuid\) FROM PUBLIC, anon, authenticated, service_role;/);
  const grants = [...sql.matchAll(/GRANT EXECUTE ON FUNCTION public\.begin_session_purge\(uuid, uuid\) TO (\w+);/g)];
  assert.deepEqual(grants.map(g => g[1]), ['service_role']);
  assert.match(sql, /begin_session_purge\([^]*?SECURITY DEFINER\nSET search_path = pg_catalog/);
  const p = body('begin_session_purge');
  assert.equal((p.match(/v_owner <> p_user_id/g) ?? []).length, 2);
  assert.match(p, /FOR UPDATE/);
  assert.match(p, /deleted_at = COALESCE\(deleted_at, pg_catalog\.now\(\)\)/);
  for (const status of ['started', 'already_started', 'not_found', 'forbidden', 'invalid_request']) assert.ok(p.includes(`'${status}'`));
  assert.doesNotMatch(p, /DELETE|storage\.|image_url|raw_ocr_text/);
});

test('STATIC_CONTRACT new definers explicitly revoke public execution; key helper cannot lock', () => {
  for (const signature of ['session_mutation_lock_key(uuid)', 'session_material_session_id(text)',
    'can_write_session_material(text)', 'can_read_session_material(text)', 'begin_session_purge(uuid, uuid)']) {
    assert.ok(sql.includes(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated, service_role;`));
  }
  assert.doesNotMatch(body('session_mutation_lock_key'), /pg_advisory/);
});

test('STATIC_CONTRACT AI RPC differs only by active parent checks and shared row fencing; accounting unchanged', () => {
  const old = before('check_and_reserve_ai_usage');
  const current = sql.match(/CREATE OR REPLACE FUNCTION public\.check_and_reserve_ai_usage[^]*?\$function\$;/)[0];
  assert.equal(current.replaceAll('WHERE id = p_session_id AND deleted_at IS NULL FOR SHARE;', 'WHERE id = p_session_id;'), old);
  assert.equal((body('check_and_reserve_ai_usage').match(/deleted_at IS NULL FOR SHARE/g) ?? []).length, 2);
  assert.doesNotMatch(sql, /(?:GRANT|REVOKE|ALTER FUNCTION)[^;]*check_and_reserve_ai_usage/);
  assert.match(baseline, /usage_events_session_id_fkey[^\n]*ON DELETE SET NULL/);
  assert.doesNotMatch(sql, /CREATE OR REPLACE FUNCTION public\.check_and_reserve_tutor_usage/);
  assert.match(before('check_and_reserve_tutor_usage'), /WHERE id = p_session_id AND deleted_at IS NULL/);
});

for (const name of ['analyze-notes', 'regenerate-module']) {
  test(`STATIC_CONTRACT ${name} initial and final queries filter owner/active and prove persistence`, () => {
    const source = read(`supabase/functions/${name}/index.ts`);
    const queries = [...source.matchAll(/\.from\('study_sessions'\)([^]*?)\.(?:single|maybeSingle)\(\);/g)];
    assert.equal(queries.length, 2);
    for (const q of queries) {
      assert.match(q[1], /\.eq\('id', sessionId\)/);
      assert.match(q[1], /\.eq\('user_id', userId\)/);
      assert.match(q[1], /\.is\('deleted_at', null\)/);
    }
    assert.match(queries[1][1], /\.select\('id'\)/);
    assert.match(source, /if \(!updatedSession \|\| updatedSession\.id !== sessionId\)/);
    const canceled = source.slice(source.indexOf('if (!updatedSession'), source.indexOf('// Successful', source.indexOf('if (!updatedSession')));
    assert.match(canceled, /await cleanupReservation\(\)/);
    assert.match(canceled, /success: false, canceled: true, error: 'session_unavailable'/);
    assert.match(canceled, /status: 409/);
  });
}

test('STATIC_CONTRACT all privileged chat session reads retain active owner filters; no backend message persistence', () => {
  const source = read('supabase/functions/chat-tutor/index.ts');
  const queries = [...source.matchAll(/\.from\('study_sessions'\)([^]*?)\.maybeSingle\(\);/g)];
  assert.equal(queries.length, 3);
  for (const q of queries) {
    assert.match(q[1], /\.eq\('user_id', userId\)/);
    assert.match(q[1], /\.is\('deleted_at', null\)/);
  }
  assert.doesNotMatch(source, /\.from\('tutor_messages'\)/);
});

test('STATIC_CONTRACT every new upload uses user/session namespace and real destination before Storage', () => {
  const tree = ts.createSourceFile('UploadPage.tsx', upload, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const paths = [];
  const roots = [];
  const uploads = [];
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'filePath') paths.push(node.initializer.getText(tree));
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      if (node.expression.name.text === 'upload') uploads.push(node.getStart(tree));
      if (node.expression.name.text === 'insert' && ts.isObjectLiteralExpression(node.arguments[0])) {
        const props = Object.fromEntries(node.arguments[0].properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(tree), p.initializer.getText(tree)]));
        if (props.user_id === 'user.id') roots.push({ position: node.getStart(tree), props });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.equal(paths.length, 2);
  for (const path of paths) assert.ok(path.startsWith('`${user.id}/${sessionId}/'));
  assert.equal(roots.length, 2);
  assert.equal(uploads.length, 2);
  for (const [i, r] of roots.entries()) {
    assert.equal(r.props.id, 'sessionId');
    assert.ok(['filePath', 'primaryPath'].includes(r.props.image_url));
    assert.ok(r.position < uploads[i]);
  }
  assert.equal(roots[0].props.raw_ocr_text, 'documentFile.text');
  assert.doesNotMatch(upload, /image_url:\s*''|\$\{user\.id\}\/uploads\//);
  assert.doesNotMatch(upload, /\.from\('study_sessions'\)\.delete\(/);
});

// Executable specification of ordering, linked to the SQL statements above.
// No production helper/Storage engine is mocked as if it were runtime proof.
function barrierModel() {
  let tail = Promise.resolve();
  const events = [];
  const state = { deleted: false, metadata: [] };
  async function locked(label, work) {
    const previous = tail;
    let release;
    tail = new Promise(resolve => { release = resolve; });
    events.push(label + ':waiting');
    await previous;
    events.push(label + ':locked');
    try { return await work(); } finally { events.push(label + ':released'); release(); }
  }
  return {
    events, state,
    write: gate => locked('write', async () => {
      if (state.deleted) { events.push('write:denied'); return false; }
      if (gate) await gate;
      state.metadata.push('synthetic-object'); events.push('metadata:committed'); return true;
    }),
    purge: gate => locked('purge', async () => {
      if (gate) await gate;
      const status = state.deleted ? 'already_started' : 'started';
      state.deleted = true; events.push('deleted:committed'); return status;
    }),
  };
}

test('SPECIFICATION_MODEL CASE A: Storage metadata commits before waiting purge; inventory sees it', async () => {
  const m = barrierModel();
  let release;
  const write = m.write(new Promise(r => { release = r; }));
  await Promise.resolve();
  const purge = m.purge();
  await Promise.resolve();
  assert.equal(m.state.deleted, false);
  assert.deepEqual(m.state.metadata, []);
  release();
  assert.equal(await write, true);
  assert.equal(await purge, 'started');
  assert.ok(m.events.indexOf('metadata:committed') < m.events.indexOf('deleted:committed'));
  assert.deepEqual(m.state.metadata, ['synthetic-object']);
});

test('SPECIFICATION_MODEL CASE B: purge commits first; waiting write recheck denies metadata', async () => {
  const m = barrierModel();
  let release;
  const purge = m.purge(new Promise(r => { release = r; }));
  await Promise.resolve();
  const write = m.write();
  release();
  assert.equal(await purge, 'started');
  assert.equal(await write, false);
  assert.deepEqual(m.state.metadata, []);
  assert.ok(m.events.indexOf('deleted:committed') < m.events.indexOf('write:denied'));
});

test('SPECIFICATION_MODEL repeated begin remains pending without removing metadata', async () => {
  const m = barrierModel();
  await m.write();
  assert.equal(await m.purge(), 'started');
  assert.equal(await m.purge(), 'already_started');
  assert.deepEqual(m.state.metadata, ['synthetic-object']);
});
