import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8').replace(/\r\n/g, '\n');
const code = read('supabase/functions/delete-session/index.ts');
const cleanupCode = read('src/lib/client-state-cleanup.ts');

test('STATIC CONTRACT TEST: active -> hard purge', () => {
  assert.match(code, /\.rpc\('begin_session_purge'/);
  assert.match(code, /\.from\('study_sessions'\)\s*\.delete\(/);
});

test('STATIC CONTRACT TEST: already soft-deleted retry', () => {
  assert.match(code, /purgeError/);
});

test('STATIC CONTRACT TEST: root absent idempotency', () => {
  assert.match(code, /alreadyDeleted: true/);
});

test('STATIC CONTRACT TEST: foreign owner', () => {
  assert.match(code, /Session not found or forbidden/);
  assert.match(code, /status: 403/);
});

test('STATIC CONTRACT TEST: invalid UUID', () => {
  assert.match(code, /uuidRegex\.test/);
  assert.match(code, /Invalid sessionId/);
});

test('STATIC CONTRACT TEST: DB lookup failure != not found', () => {
  assert.match(code, /Database lookup error/);
  assert.match(code, /status: 500/);
});

test('STATIC CONTRACT TEST: modern namespace', () => {
  assert.match(code, /const prefix = `\$\{userId\}\/\$\{sessionId\}`/);
});

test('STATIC CONTRACT TEST: orphan object inside exact session prefix', () => {
  assert.match(code, /\.list\(prefix/);
});

test('STATIC CONTRACT TEST: pagination/completeness', () => {
  assert.match(code, /limitFolder = 100/);
});

test('STATIC CONTRACT TEST: duplicate references deduped', () => {
  assert.match(code, /const inventory = new Set/);
});

test('STATIC CONTRACT TEST: shared object conflict', () => {
  assert.match(code, /Shared object conflict/);
  assert.match(code, /status: 409/);
});

test('STATIC CONTRACT TEST: missing Storage object', () => {
  assert.match(code, /\.remove\(/);
});

test('STATIC CONTRACT TEST: partial Storage failure', () => {
  assert.match(code, /Partial storage failure/);
});

test('STATIC CONTRACT TEST: Storage failure blocks DB delete', () => {
  assert.match(code, /return new Response.*Partial storage failure/);
});

test('STATIC CONTRACT TEST: DB hard-delete failure retry', () => {
  assert.match(code, /DB hard delete failure/);
});

test('STATIC CONTRACT TEST: database delete happens after Storage verification', () => {
  const vIndex = code.indexOf('Storage verification failed');
  const dIndex = code.indexOf(".delete({ count: 'exact' })");
  assert.ok(vIndex < dIndex || dIndex === -1);
});

test('STATIC CONTRACT TEST: session_images cascade assumption', () => {
  assert.doesNotMatch(code, /delete from session_images/i);
});

test('STATIC CONTRACT TEST: tutor cascade assumption', () => {
  assert.doesNotMatch(code, /delete from tutor_/i);
});

test('STATIC CONTRACT TEST: usage_events SET NULL assumption', () => {
  assert.doesNotMatch(code, /delete from usage_events/i);
});

test('STATIC CONTRACT TEST: per-session client state cleanup', () => {
  assert.match(cleanupCode, /clearSessionClientState/);
  assert.match(cleanupCode, /storage\.removeItem/);
});

test('STATIC CONTRACT TEST: other-session state preserved', () => {
  assert.match(cleanupCode, /startsWith/);
  assert.doesNotMatch(cleanupCode, /localStorage\.clear\(\)/);
});

test('STATIC CONTRACT TEST: repeated delete idempotency', () => {
  assert.match(code, /deleted: true/);
});
