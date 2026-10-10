import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../../', import.meta.url);
const manifest = readFileSync(new URL('docs/database/MIGRATION_BASELINE_2026.md', root), 'utf8');
const match = manifest.match(/```json canonical-contract\n([\s\S]*?)\n```/);
assert.ok(match, 'reviewed normalization manifest is required');
export const normalizationContract = JSON.parse(match[1]);
export const archiveDirectory = 'supabase/migration_archive/legacy_pre_baseline';
export const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();

// These checks replace historical path-based git-diff freezes with stronger
// byte checks after the authorized relocation. They also work after committing
// the relocation, without requiring an old Git object in a shallow checkout.
export function assertArchivedMigrationsUnchanged(maxVersion = 82) {
  const rows = normalizationContract.archived;
  assert.equal(rows.length, 42);
  // Pin the pre-move checksum ledger independently of the editable manifest.
  assert.equal(hash(rows.map(r => `${r.filename}:${r.sha256}`).join('\n')),
    '67FF5ED8FFAA2B1DA7FE9DDB6386188488ABF9FB26F7BF4E2DB5BE394EBF58EF');
  assert.deepEqual(readdirSync(new URL(archiveDirectory + '/', root)).sort(), rows.map(r => r.filename).sort());
  for (const row of rows.filter(r => Number(r.version) <= maxVersion)) {
    assert.equal(row.archive_path, `${archiveDirectory}/${row.filename}`);
    assert.equal(hash(readFileSync(new URL(row.archive_path, root))), row.sha256, row.filename);
  }
}

export function assertOnlyNormalizationChanges(additionalAllowed = []) {
  assertArchivedMigrationsUnchanged();
  const allowed = new Set([
    '.gitattributes',
    ...normalizationContract.archived.map(r => 'supabase/migrations/' + r.filename),
    'supabase/migrations/00083_priv02_soft_deleted_session_access.sql',
    'docs/database/MIGRATION_BASELINE_2026.md',
    'supabase/tests/priv02_soft_deleted_session_access.test.sql',
    'tests/session-rls-access.test.mjs', 'tests/migration-baseline.test.mjs',
    'tests/helpers/migration-provenance.mjs',
    'tests/account-security.test.mjs', 'tests/ai-usage-guard.test.mjs',
    'tests/f04-storage-ownership.test.mjs', 'tests/stripe-payment-binding.test.mjs',
    'tests/priv01-under13-retention.test.mjs', 'tests/priv01-parent-reminder.test.mjs',
    ...additionalAllowed,
  ]);
  const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], {
    cwd: root, encoding: 'utf8',
  }).trim().split(/\r?\n/).filter(Boolean);
  assert.deepEqual(changed.filter(p => !allowed.has(p)), [], 'unrelated production changes are prohibited');
}
