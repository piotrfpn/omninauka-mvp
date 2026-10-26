import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const PINNED_MAIN = '009206ec151f98bc7ddf323fb4aef36dfa4827c8';
export const REVIEWED_DIGEST = '2dc0e8c663f84a782cf68dc6414046bf225e40bf1fb3af53428794044f132c1e';
const fixturePath = 'tests/fixtures/p03b-reviewed-contract.json';
// Layer B authorizes paths only. Final policy contents require independent review.
export const TEST_POLICY_PATHS = Object.freeze([
  'tests/account-security.test.mjs',
  'tests/managed-child-identity.test.mjs',
  'tests/p02-auth-errors.test.mjs',
  'tests/helpers/migration-provenance.mjs',
  'tests/helpers/p03b-contract.mjs',
  fixturePath,
]);
const policy = new Set(TEST_POLICY_PATHS);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const lf = bytes => bytes.toString('utf8').replace(/\r\n/g, '\n');
const git = (args, options = {}) => execFileSync('git', ['--no-optional-locks', ...args], {
  cwd: root, maxBuffer: 64 * 1024 * 1024, ...options,
});
const paths = args => git(args).toString('utf8').split('\0').filter(Boolean);
const sensitive = path => /(^|\/)(\.env(?:\..*)?|\.vercel|\.supabase|.*\.(pem|key|p12|pfx))($|\/)/i.test(path);

function originalManifest(bytes) {
  // Lossless single-line envelope survives Windows checkout without changing reviewed bytes.
  const envelope = JSON.parse(bytes.toString('utf8'));
  assert.deepEqual(Object.keys(envelope).sort(), ['approvedSha256', 'originalBase64']);
  assert.equal(envelope.approvedSha256, REVIEWED_DIGEST);
  const raw = Buffer.from(envelope.originalBase64, 'base64');
  assert.equal(raw.toString('base64'), envelope.originalBase64, 'Canonical base64 required');
  assert.equal(digest(raw), REVIEWED_DIGEST, 'Original reviewed manifest bytes changed');
  assert.equal(bytes.toString('utf8'), JSON.stringify(envelope), 'Single-line fixture required');
  return raw;
}

function reviewedContract() {
  const raw = originalManifest(readFileSync(new URL('../fixtures/p03b-reviewed-contract.json', import.meta.url)));
  const contract = JSON.parse(raw);
  assert.equal(contract.main, PINNED_MAIN);
  assert.equal(Object.keys(contract.delta).length, 14);
  assert.equal(Object.keys(contract.retainedReleasedPaths).length, 12);
  // Missing baseline is fatal; there is no fallback to HEAD or a generated manifest.
  git(['cat-file', '-e', `${PINNED_MAIN}^{commit}`]);
  return contract;
}

function verifyBytes(path, bytes, contract, layer) {
  assert.ok(!sensitive(path), `${layer}: sensitive path changed`);
  if (path === fixturePath) {
    originalManifest(bytes);
    return;
  }
  if (policy.has(path)) return;
  const expected = contract.delta[path] ?? contract.retainedReleasedPaths[path];
  assert.ok(expected, `${layer}: unexpected change ${JSON.stringify(path)}`);
  assert.ok(expected.mode === 'raw-bytes' || expected.mode === 'utf8-lf');
  assert.equal(digest(expected.mode === 'raw-bytes' ? bytes : lf(bytes)), expected.sha256,
    `${layer}: immutable content changed ${JSON.stringify(path)}`);
}

/** Layer A: exact reviewed source. Layer B: explicit test-policy scope, never globbed. */
export function assertReviewedCandidate() {
  const contract = reviewedContract();
  for (const path of [...Object.keys(contract.delta), ...Object.keys(contract.retainedReleasedPaths), ...TEST_POLICY_PATHS]) {
    assert.ok(existsSync(new URL('../../' + path, import.meta.url)), `Required file missing: ${path}`);
    verifyBytes(path, readFileSync(new URL('../../' + path, import.meta.url)), contract, 'worktree');
  }
  const worktreeChanges = new Set([
    ...paths(['diff', '--no-renames', '--name-only', '-z', PINNED_MAIN, '--']),
    ...paths(['ls-files', '--others', '--exclude-standard', '-z']),
  ]);
  for (const path of worktreeChanges) {
    assert.ok(!sensitive(path), 'Unexpected sensitive path delta');
    assert.ok(policy.has(path) || contract.delta[path], `Unexpected file/change: ${JSON.stringify(path)}`);
    assert.ok(existsSync(new URL('../../' + path, import.meta.url)), `Deleted file: ${path}`);
    verifyBytes(path, readFileSync(new URL('../../' + path, import.meta.url)), contract, 'worktree');
  }
  // Inspect each persisted layer as well: an unstaged restoration cannot hide bad staging/commits.
  for (const [layer, diffArgs, prefix] of [
    ['index', ['diff', '--cached', '--no-renames', '--name-only', '-z', PINNED_MAIN, '--'], ':'],
    ['HEAD', ['diff', '--no-renames', '--name-only', '-z', PINNED_MAIN, 'HEAD', '--'], 'HEAD:'],
  ]) {
    for (const path of paths(diffArgs)) {
      assert.ok(!sensitive(path), `${layer}: sensitive path delta`);
      assert.ok(policy.has(path) || contract.delta[path], `${layer}: unexpected file/change ${JSON.stringify(path)}`);
      // A deleted tracked file has no blob and fails closed here, including policy files.
      const bytes = git(['show', prefix + path]);
      verifyBytes(path, bytes, contract, layer);
    }
  }
  for (const entry of paths(['ls-files', '--stage', '-z'])) {
    assert.equal(entry.slice(0, entry.indexOf('\t')).split(' ')[2], '0', 'Unmerged index entry');
  }
  for (const entry of paths(['ls-files', '-v', '-z'])) {
    assert.ok(!/^[a-zS]/.test(entry), 'Assume-unchanged/skip-worktree could hide changes');
  }
}

export function readPinnedMain(path) {
  reviewedContract();
  assert.ok(!sensitive(path));
  return lf(git(['show', `${PINNED_MAIN}:${path}`]));
}

/** One literal reviewed replacement; all remaining register statements remain frozen. */
export function expectedReviewedRegister(before) {
  const oldBlock = `      console.error("SignUp Error:", error);
      let errorMessage = error.message;
      if (errorMessage.toLowerCase().includes('rate limit')) {
        errorMessage = 'Przekroczono chwilowy limit prób mailowych. Odczekaj chwilę i spróbuj ponownie.';
      } else if (errorMessage.toLowerCase().includes('password')) {
        errorMessage = 'Hasło jest zbyt proste lub brakuje mu znaków (minimum 6).';
      }
      return { success: false, message: errorMessage };`;
  const normalized = lf(Buffer.from(before));
  assert.equal(normalized.split(oldBlock).length, 2, 'Exactly one baseline error block is required');
  return normalized.replace(oldBlock, '      return { success: false, errorKey: authErrorKey(error) };');
}
