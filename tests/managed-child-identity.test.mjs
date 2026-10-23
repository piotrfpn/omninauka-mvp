import { assertReviewedCandidate } from './helpers/p03b-contract.mjs';
// LOCAL_RUNTIME / MOCKED_SDK / STATIC_SQL only. No live Auth, email or PostgreSQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import * as identity from '../supabase/functions/_shared/managed-child-identity.ts';

const root = new URL('../', import.meta.url);
const helperPath = 'supabase/functions/_shared/managed-child-identity.ts';
const migrationName = '20261020204341_auth_u13_managed_identity_foundation.sql';
const source = readFileSync(new URL(helperPath, root), 'utf8');
const sql = readFileSync(new URL('supabase/migrations/' + migrationName, root), 'utf8');
const config = identity.readManagedChildIdentityConfig(name => ({
  MANAGED_CHILD_IDENTITIES_ENABLED: 'true',
  MANAGED_CHILD_IDENTITY_NAMESPACE: 'children.example.invalid',
})[name]);
const code = '7fd2k9m3pq8r';

function sandbox(globals = {}) {
  const exports = {};
  let networkCalls = 0;
  const output = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }}).outputText;
  vm.runInNewContext(output, {
    exports, crypto: webcrypto,
    fetch() { networkCalls++; throw new Error('network_forbidden'); },
    ...globals,
  });
  return { exports, networkCalls: () => networkCalls };
}

test('default configuration is disabled and namespace is only a proposal', () => {
  const defaults = identity.readManagedChildIdentityConfig();
  assert.deepEqual(defaults, { enabled: false, namespace: 'dzieci.omninauka.eu' });
  assert.ok(Object.isFrozen(defaults));
  assert.throws(() => identity.generateManagedChildIdentity(defaults), /identity_disabled/);
});

for (const flag of [undefined, '', 'false', 'TRUE', '1', ' true ']) {
  test(`only exact explicit enable flag permits generation: ${String(flag)}`, () => {
    const disabled = identity.readManagedChildIdentityConfig(name => name.endsWith('ENABLED') ? flag : undefined);
    assert.equal(disabled.enabled, false);
    let writes = 0;
    return assert.rejects(identity.reserveManagedChildIdentifier(disabled, async () => {
      writes++;
      return 'reserved';
    }), /identity_disabled/).then(() => assert.equal(writes, 0));
  });
}

test('format has exactly 60 random bits and excludes ambiguous 0, 1, I and O', () => {
  assert.equal(identity.MANAGED_CHILD_ALPHABET.length, 32);
  assert.equal(new Set(identity.MANAGED_CHILD_ALPHABET).size, 32);
  assert.doesNotMatch(identity.MANAGED_CHILD_ALPHABET, /[01io]/);
  assert.equal(identity.MANAGED_CHILD_CODE_LENGTH * Math.log2(identity.MANAGED_CHILD_ALPHABET.length), 60);
  assert.equal(identity.MANAGED_CHILD_ENTROPY_BITS, 60);
  // Each symbol has exactly eight preimages from one uniform random byte.
  const counts = Array(32).fill(0);
  for (let byte = 0; byte < 256; byte++) counts[byte & 31]++;
  assert.deepEqual(counts, Array(32).fill(8));
});

test('generation uses Web Crypto, carries no personal input, and returns a coherent candidate', () => {
  const generated = new Set();
  for (let i = 0; i < 256; i++) {
    const candidate = identity.generateManagedChildIdentity(config);
    assert.match(candidate.loginCode, /^[23456789abcdefghjklmnpqrstuvwxyz]{12}$/);
    assert.match(candidate.loginIdentifier, /^UCZEN-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    assert.equal(candidate.technicalEmail, `u-${candidate.loginCode}@children.example.invalid`);
    assert.deepEqual(Object.keys(candidate).sort(), ['loginCode', 'loginIdentifier', 'namespace', 'technicalEmail']);
    assert.ok(Object.isFrozen(candidate));
    generated.add(candidate.loginCode);
  }
  // Smoke only; database constraints, not this probabilistic sample, guarantee uniqueness.
  assert.equal(generated.size, 256);
  const boot = sandbox({ crypto: { getRandomValues(bytes) { bytes.fill(0); return bytes; } } });
  assert.equal(boot.exports.generateManagedChildIdentity(config).loginCode, '2'.repeat(12));
  assert.equal(boot.networkCalls(), 0);
});

for (const value of [code, code.toUpperCase(), 'UCZEN-' + code,
  'uczen-7FD2-k9m3-PQ8R', '7fd2-k9m3-pq8r', '  UCZEN-7FD2-K9M3-PQ8R  ']) {
  test(`canonical normalization: ${value}`, () => {
    assert.equal(identity.normalizeManagedChildLogin(value), code);
    assert.equal(identity.presentManagedChildLogin(value), 'UCZEN-7FD2-K9M3-PQ8R');
    assert.equal(identity.deriveManagedChildTechnicalEmail(value, 'CHILDREN.EXAMPLE.INVALID'), `u-${code}@children.example.invalid`);
  });
}

for (const value of [null, undefined, {}, 123, '', ' ', '7fd2k9', code.slice(1), code + '2',
  'UCZEN--' + code, 'UCZEN-7FD-2K9M3-PQ8R', 'uczeń-' + code, 'u-' + code,
  '7fd2k9m3pq80', '7fd2k9m3pq81', '7fd2k9m3pq8i', '7fd2k9m3pq8o',
  '7fd2k9m3pq8K', '7fd2k9m3pq8а', code + '@example.invalid', '7fd2\nk9m3pq8r',
  '7fd2_k9m3pq8r', '7fd2/k9m3pq8r', '7fd2\u200bk9m3pq8r']) {
  test(`reject malformed/non-ASCII identifier: ${JSON.stringify(value)}`, () => {
    assert.throws(() => identity.normalizeManagedChildLogin(value), /invalid_managed_child_login/);
  });
}

for (const namespace of ['', 'localhost', 'example.invalid', 'https://children.example.invalid',
  'children.example.invalid/', 'children.example.invalid:443', '*.example.invalid',
  'children..example.invalid', '-children.example.invalid', 'children-.example.invalid',
  'children.exämple.invalid', 'children.example.invalid.', 'children@example.invalid',
  `${'a'.repeat(64)}.example.invalid`, `${'a'.repeat(62)}.${'b'.repeat(62)}.${'c'.repeat(62)}.${'d'.repeat(62)}.invalid`]) {
  test(`reject malformed namespace: ${namespace.slice(0, 80)}`, () => {
    assert.throws(() => identity.deriveManagedChildTechnicalEmail(code, namespace), /invalid_managed_child_namespace/);
  });
}

test('Web Crypto failure propagates; no Math.random or predictable fallback', () => {
  const boot = sandbox({ crypto: { getRandomValues() { throw new Error('rng_unavailable'); } } });
  assert.throws(() => boot.exports.generateManagedChildIdentity(config), /rng_unavailable/);
  assert.doesNotMatch(source, /Math\.random|Date\.now/);
});

test('a classified identifier collision generates a fresh candidate, then returns committed reservation', async () => {
  let sequence = 0;
  const boot = sandbox({ crypto: { getRandomValues(bytes) { bytes.fill(sequence++); return bytes; } } });
  const seen = [];
  const result = await boot.exports.reserveManagedChildIdentifier(config, async candidate => {
    seen.push(candidate.loginCode);
    return seen.length === 1 ? 'identifier_collision' : 'reserved';
  });
  assert.deepEqual(seen, ['2'.repeat(12), '3'.repeat(12)]);
  assert.equal(result.loginCode, seen[1]);
});

test('collision exhaustion stops after five attempts', async () => {
  let attempts = 0;
  await assert.rejects(identity.reserveManagedChildIdentifier(config, async () => {
    attempts++;
    return 'identifier_collision';
  }), /collision_limit/);
  assert.equal(attempts, 5);
});

test('ownership, UUID and idempotency conflicts propagate without regeneration', async () => {
  for (const constraint of ['parent_owner', 'reserved_auth_user_id_key', 'operation_idempotency']) {
    let attempts = 0;
    const failure = Object.assign(new Error('reservation_rejected'), { code: '23505', constraint });
    await assert.rejects(identity.reserveManagedChildIdentifier(config, async () => {
      attempts++;
      throw failure;
    }), error => error === failure);
    assert.equal(attempts, 1);
  }
  await assert.rejects(identity.reserveManagedChildIdentifier(config, async () => 'active'), /invalid_managed_child_reservation_result/);
});

test('import and all pure helpers do not read environment or call network; browser use fails closed', () => {
  const boot = sandbox();
  assert.equal(boot.networkCalls(), 0);
  boot.exports.readManagedChildIdentityConfig();
  boot.exports.deriveManagedChildTechnicalEmail(code, config.namespace);
  boot.exports.generateManagedChildIdentity(config);
  assert.equal(boot.networkCalls(), 0);
  assert.doesNotMatch(source, /^import |Deno\.|process\.env|fetch\(|console\./m);
  const browser = sandbox({ window: {} });
  assert.throws(() => browser.exports.readManagedChildIdentityConfig(), /server_only/);
  assert.throws(() => browser.exports.generateManagedChildIdentity(config), /server_only/);
  assert.throws(() => browser.exports.normalizeManagedChildLogin(code), /server_only/);
});

test('installed SDK transports assigned UUID and technical confirmation using ONLY an injected fake fetch', async () => {
  let requests = 0;
  const assignedId = '11111111-1111-4111-8111-111111111111';
  const sdk = createClient('https://example.invalid', 'test-only-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      requests++;
      assert.equal(String(url), 'https://example.invalid/auth/v1/admin/users');
      assert.equal(init.method, 'POST');
      const body = JSON.parse(init.body);
      assert.equal(body.id, assignedId);
      assert.equal(body.email_confirm, true);
      assert.equal(body.email, `u-${code}@children.example.invalid`);
      assert.equal(body.password, 'synthetic-fixture-only');
      return new Response(JSON.stringify({ id: assignedId, email: body.email, identities: [] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    } },
  });
  const result = await sdk.auth.admin.createUser({ id: assignedId,
    email: `u-${code}@children.example.invalid`, password: 'synthetic-fixture-only', email_confirm: true });
  assert.equal(result.error, null);
  assert.equal(result.data.user.id, assignedId);
  assert.equal(requests, 1);
});

test('actual SDK and utility types compile without emitting or constructing a real client', () => {
  const virtualPath = fileURLToPath(new URL('supabase/functions/__managed_child_sdk_virtual.ts', root)).replaceAll('\\', '/');
  const declarations = `import type { SupabaseClient } from '@supabase/supabase-js';
    declare const client: SupabaseClient;
    client.auth.admin.createUser({ id: '11111111-1111-4111-8111-111111111111',
      email: 'fixture@children.example.invalid', password: 'synthetic-only', email_confirm: true });`;
  const options = { noEmit: true, strict: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true, skipLibCheck: true };
  const host = ts.createCompilerHost(options);
  const get = host.getSourceFile.bind(host), exists = host.fileExists.bind(host), read = host.readFile.bind(host);
  const isVirtual = path => path.replaceAll('\\', '/') === virtualPath;
  host.fileExists = path => isVirtual(path) || exists(path);
  host.readFile = path => isVirtual(path) ? declarations : read(path);
  host.getSourceFile = (path, ...args) => isVirtual(path) ? ts.createSourceFile(path, declarations, options.target) : get(path, ...args);
  const program = ts.createProgram([fileURLToPath(new URL(helperPath, root)), virtualPath], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => process.cwd(), getCanonicalFileName: name => name, getNewLine: () => '\n',
  }));
});

test('STATIC_SQL private schema ACL and deny-by-default RLS cover both registries', () => {
  assert.match(sql, /CREATE SCHEMA managed_child_private AUTHORIZATION postgres/);
  assert.match(sql, /REVOKE ALL ON SCHEMA managed_child_private FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql, /GRANT USAGE ON SCHEMA managed_child_private TO service_role/);
  for (const table of ['identities', 'operations']) {
    assert.match(sql, new RegExp(`ALTER TABLE managed_child_private\\.${table} OWNER TO postgres`));
    assert.match(sql, new RegExp(`ALTER TABLE managed_child_private\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(sql, new RegExp(`ALTER TABLE managed_child_private\\.${table} FORCE ROW LEVEL SECURITY`));
  }
  assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*?FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON TABLE[^;]+TO service_role/);
  assert.doesNotMatch(sql, /CREATE POLICY|GRANT (?:ALL|DELETE|CREATE)|TO (?:anon|authenticated)|pgrst\./i);
  assert.match(sql, /REVOKE ALL ON FUNCTION[^;]+FROM PUBLIC, anon, authenticated, service_role/);
});

test('STATIC_SQL generated technical identifiers, unique reservations and composite owner prevent ambiguous claims', () => {
  assert.match(sql, /login_code text NOT NULL UNIQUE CHECK/);
  assert.match(sql, /technical_email text GENERATED ALWAYS AS \('u-' \|\| login_code \|\| '@' \|\| namespace\) STORED UNIQUE/);
  assert.match(sql, /child_profile_id uuid NOT NULL UNIQUE REFERENCES public\.child_profiles/);
  assert.match(sql, /reserved_auth_user_id uuid NOT NULL UNIQUE,/);
  assert.doesNotMatch(sql, /reserved_auth_user_id uuid[^\n]*REFERENCES/);
  assert.match(sql, /NEW\.reserved_auth_user_id := pg_catalog\.gen_random_uuid\(\)/);
  assert.match(sql, /managed_child_no_auth_binding_yet CHECK \(auth_user_id IS NULL\)/);
  assert.match(sql, /FOREIGN KEY \(identity_id, parent_user_id\)/);
  assert.match(sql, /UNIQUE \(parent_user_id, operation_type, idempotency_key\)/);
  assert.match(sql, /UNIQUE INDEX managed_child_one_pending_operation/);
});

test('STATIC_SQL ownership is rechecked by UUID against verified active parent; existing account selection is disabled', () => {
  assert.match(sql, /cp\.id = NEW\.child_profile_id AND cp\.parent_user_id = p\.id/);
  assert.match(sql, /p\.id = NEW\.parent_user_id AND p\.user_role = 'parent' AND p\.account_status = 'active'/);
  assert.match(sql, /a\.email_confirmed_at IS NOT NULL/);
  assert.match(sql, /cp\.child_user_id IS NULL/);
  assert.match(sql, /cp\.guardian_consent_version = 'child_email_preapproval_v1'/);
  assert.match(sql, /FOR SHARE OF p, cp/);
  assert.match(sql, /NEW\.auth_user_id IS NOT NULL/);
  assert.doesNotMatch(sql, /\bcp\.child_email(?:_normalized)?\b|auth\.jwt|user_metadata|raw_user_meta_data/i);
});

test('STATIC_SQL foundation cannot activate an identity, execute operations or store unstructured secrets', () => {
  assert.match(sql, /lifecycle_state IN \('reserved', 'cancelled'\)/);
  assert.match(sql, /processing_phase IN \('planned', 'cancelled'\)/);
  assert.match(sql, /finalization_status IN \('pending', 'cancelled'\)/);
  assert.match(sql, /OLD\.lifecycle_state <> 'reserved' OR NEW\.lifecycle_state <> 'cancelled'/);
  assert.match(sql, /OLD\.processing_phase <> 'planned' OR NEW\.processing_phase <> 'cancelled'/);
  assert.match(sql, /NEW\.execution_version := OLD\.execution_version \+ 1/);
  const definitions = sql.match(/CREATE TABLE[\s\S]*?\n\);/g).join('\n').replace(/--[^\n]*/g, '');
  assert.doesNotMatch(definitions, /password|token|secret|credential|payload|jsonb|metadata|error_message/i);
  assert.match(definitions, /safe_error_category text CHECK \(safe_error_category IN/);
});

test('STATIC_SQL only additive private objects; no hooks or writes to existing app/Auth resources', () => {
  assert.ok(sql.trim().endsWith('COMMIT;'));
  assert.doesNotMatch(sql, /CREATE OR REPLACE|CREATE POLICY|ALTER TABLE (?:public|auth|storage)\.|(?:INSERT INTO|UPDATE|DELETE FROM) (?:public|auth|storage)\.|net\.|cron\.|email_confirm\s*:/i);
  assert.equal([...sql.matchAll(/CREATE TABLE /g)].length, 2);
  assert.equal([...sql.matchAll(/CREATE TRIGGER /g)].length, 2);
  assert.equal([...sql.matchAll(/SECURITY DEFINER SET search_path = ''/g)].length, 2);
});

test('existing frontend, Edge entrypoints, Auth contracts and migration bytes remain unchanged', () => {
  // Git normalizes source EOL; the existing baseline suite separately pins SQL bytes.
  assertReviewedCandidate();
  assert.ok(readdirSync(new URL('supabase/migrations/', root)).includes(migrationName));
});
