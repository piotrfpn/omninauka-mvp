import { assertOnlyNormalizationChanges } from './helpers/migration-provenance.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createClientStateFixture } from './client-state-fixture.mjs';

// STATIC_CONTRACT checks the actual SQL/copy. POLICY_MODEL checks deadline/state
// vectors using constants extracted from SQL. Neither executes PostgreSQL or proves
// deployed RLS/locks; those require controlled DB validation after independent review.
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const [sql, historical, config, privacy, terms, plText, enText] = await Promise.all([
  read('supabase/migration_archive/legacy_pre_baseline/00081_under13_pending_retention_cleanup.sql'),
  read('supabase/migration_archive/legacy_pre_baseline/00076_child_profiles_authorization_hardening.sql'),
  read('supabase/config.toml'), read('src/pages/legal/PrivacyPage.tsx'),
  read('src/pages/legal/TermsPage.tsx'), read('src/i18n/locales/pl/common.json'),
  read('src/i18n/locales/en/common.json'),
]);
const section = name => sql.split('AS $' + name + '$')[1].split('$' + name + '$;')[0];
const expiry = section('expiry');
const linker = section('link');
const upload = section('upload');
const timer = section('deadline');
const view = sql.split('CREATE OR REPLACE VIEW public.v_under13_pending_cleanup_candidates AS')[1].split(';')[0];
const clean = value => value.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
const quoted = value => [...value.matchAll(/'([^']*)'/g)].map(match => match[1]);
const activePattern = /\b(?:72\s*(?:hours?|h|godzin\w*)|3\s*(?:days?|dni))\b/i;
const intervals = [...sql.matchAll(/interval '([^']+)'/g)].map(match => match[1]);
const days = Number(intervals[0].split(' ')[0]);
const windowMs = days * 24 * 60 * 60 * 1000;
const now = Date.parse('2030-01-20T12:00:00Z');
const profile = (overrides = {}) => ({
  age: 'under_13', status: 'pending_parent_preapproval',
  createdAt: now - windowMs, pendingSince: null, trusted: false, ...overrides,
});
const elapsed = (p, at = now) => (p.pendingSince ?? p.createdAt) != null &&
  (p.pendingSince ?? p.createdAt) <= at - windowMs;
const eligible = (p, at = now) => p.age === 'under_13' &&
  p.status === 'pending_parent_preapproval' && elapsed(p, at) && !p.trusted;
const expireModel = (p, at = now) => eligible(p, at) ? { ...p, status: 'expired_pending_preapproval' } : { ...p };
const linkModel = (p, { valid = true, at = now, finalAt = at } = {}) => {
  if (p.age !== 'under_13' || !['pending_parent_preapproval', 'active'].includes(p.status)) {
    return { profile: { ...p }, linked: false };
  }
  if (p.status === 'active') return { profile: { ...p }, linked: p.trusted };
  if ((p.pendingSince ?? p.createdAt) == null) return { profile: { ...p }, linked: false };
  if (elapsed(p, at) || (valid && elapsed(p, finalAt))) {
    return { profile: { ...p, status: 'expired_pending_preapproval' }, linked: false };
  }
  return { profile: valid ? { ...p, status: 'active', trusted: true } : { ...p }, linked: valid };
};
const uploadStates = quoted(upload.match(/v_status IN \(([^)]*)\)/)[1]);
const uploadModel = p => Boolean(p && uploadStates.includes(p.status));

// Current authoritative definitions, including the formerly historical-only view.
test('STATIC_CONTRACT every new runtime interval is seven days', () => {
  assert.ok(intervals.length >= 6);
  assert.deepEqual(new Set(intervals), new Set(['7 days']));
  assert.doesNotMatch(sql, activePattern);
});
test('STATIC_CONTRACT candidate view supersedes 00076 without changing its columns or trusted-link conditions', () => {
  const old = historical.split('CREATE OR REPLACE VIEW public.v_under13_pending_cleanup_candidates AS')[1].split(';')[0];
  assert.equal(clean(view), clean(old.replace("< now() - interval '72 hours'", "<= now() - interval '7 days'")));
});
test('STATIC_CONTRACT candidate view remains service-only, including column grants', () => {
  assert.match(sql, /REVOKE ALL PRIVILEGES ON public\.v_under13_pending_cleanup_candidates FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /REVOKE ALL PRIVILEGES \(profile_id, email,[\s\S]*?ON public\.v_under13_pending_cleanup_candidates FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT SELECT ON public\.v_under13_pending_cleanup_candidates TO service_role/);
});
test('STATIC_CONTRACT expiry selection and locked recheck require age, pending and inclusive deadline', () => {
  assert.match(expiry, /p\.age_band = 'under_13'/);
  assert.match(expiry, /p\.account_status = 'pending_parent_preapproval'/);
  assert.match(expiry, /COALESCE\(p\.pending_preapproval_since, p\.created_at\) <= now\(\) - interval '7 days'/);
  assert.match(expiry, /v_profile\.age_band IS DISTINCT FROM 'under_13'/);
  assert.match(expiry, /v_profile\.account_status IS DISTINCT FROM 'pending_parent_preapproval'/);
  assert.match(expiry, /COALESCE\(v_profile\.pending_preapproval_since, v_profile\.created_at\)\s*> now\(\) - interval '7 days'/);
});
test('STATIC_CONTRACT trusted links exclude both initial selection and locked expiry recheck', () => {
  const selection = expiry.split('LOOP')[0];
  const recheck = expiry.split('LOOP')[1];
  for (const part of [selection, recheck]) {
    for (const token of ["cp.status IN ('linked', 'active')", 'cp.preapproval_integrity_version = 1',
      "parent.user_role = 'parent'", 'cp.parent_user_id <>',
      'cp.guardian_consent_acknowledged_at IS NOT NULL',
      "cp.guardian_consent_version = 'child_email_preapproval_v1'"]) assert.ok(part.includes(token), token);
  }
  assert.match(selection, /NOT EXISTS/);
  assert.match(recheck, /OR EXISTS/);
});
test('STATIC_CONTRACT expiry locks only profiles, skips locked rows, and rechecks before transition', () => {
  assert.match(expiry, /FOR UPDATE OF p SKIP LOCKED/);
  assert.ok(expiry.indexOf('FOR UPDATE OF p') < expiry.indexOf('LOOP'));
  assert.ok(expiry.indexOf('THEN CONTINUE; END IF;') < expiry.indexOf('UPDATE public.profiles'));
  assert.doesNotMatch(sql, /LOCK TABLE/i);
});
test('STATIC_CONTRACT default/max batch is 20 and expiry returns only a count', () => {
  assert.match(sql, /expire_pending_under13_accounts\(p_batch_size integer DEFAULT 20\)\s*RETURNS integer/);
  assert.match(expiry, /LIMIT LEAST\(20, GREATEST\(1, COALESCE\(p_batch_size, 20\)\)\)/);
  assert.match(expiry, /RETURN v_expired_count/);
});
test('STATIC_CONTRACT expiry mutates only pending-to-expired status', () => {
  const updates = [...expiry.matchAll(/UPDATE public\.profiles SET ([\s\S]*?);/g)];
  assert.equal(updates.length, 1);
  assert.match(updates[0][1], /^account_status = 'expired_pending_preapproval'\s+WHERE/);
  assert.match(updates[0][1], /account_status = 'pending_parent_preapproval'/);
  assert.doesNotMatch(expiry, /\b(?:DELETE|INSERT|TRUNCATE)\b/i);
  assert.doesNotMatch(expiry, /(?:created_at|pending_preapproval_since)\s*=/);
});
for (const role of ['PUBLIC', 'anon', 'authenticated']) {
  test('STATIC_CONTRACT expiry denies ' + role + ' execute', () => {
    const revoke = sql.match(/REVOKE EXECUTE ON FUNCTION public\.expire_pending_under13_accounts\(integer\) FROM ([^;]+);/)[1];
    assert.ok(revoke.split(',').map(x => x.trim()).includes(role));
    assert.doesNotMatch(sql, new RegExp('GRANT EXECUTE ON FUNCTION public\\.expire_pending_under13_accounts\\(integer\\) TO [^;]*\\b' + role + '\\b'));
  });
}
test('STATIC_CONTRACT expiry has pinned owner, SECURITY DEFINER, fixed search_path and service grant', () => {
  assert.match(sql, /expire_pending_under13_accounts\(p_batch_size integer DEFAULT 20\)[\s\S]*?SECURITY DEFINER\s+SET search_path = public\s+AS \$expiry\$/);
  assert.match(sql, /ALTER FUNCTION public\.expire_pending_under13_accounts\(integer\) OWNER TO postgres/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.expire_pending_under13_accounts\(integer\) TO service_role/);
});
test('STATIC_CONTRACT linker locks its own profile before deadline and any relation write', () => {
  assert.match(linker, /v_user_id uuid := auth\.uid\(\)/);
  assert.match(linker, /v_user_email text := auth\.jwt\(\)->>'email'/);
  const lock = linker.indexOf('WHERE p.id = v_user_id FOR UPDATE;');
  const deadline = linker.indexOf("<= clock_timestamp() - interval '7 days'");
  assert.ok(lock >= 0 && lock < deadline && deadline < linker.indexOf('UPDATE public.child_profiles'));
});
test('STATIC_CONTRACT linker rejects deadline even when scheduler has not executed', () => {
  assert.match(linker, /IF v_status = 'pending_parent_preapproval'\s+AND COALESCE\(v_pending_preapproval_since, v_created_at\) <= clock_timestamp\(\) - interval '7 days' THEN/);
  const initial = linker.slice(linker.indexOf('-- Deadline'), linker.indexOf('SELECT cp.id'));
  assert.match(initial, /UPDATE public\.profiles SET account_status = 'expired_pending_preapproval'/);
  assert.match(initial, /'linked', false, 'reason', 'preapproval_window_expired'/);
});
test('STATIC_CONTRACT expired/other ineligible statuses cannot reach activation', () => {
  assert.match(linker, /v_child_role IS DISTINCT FROM 'student'/);
  assert.match(linker, /v_status IS NULL OR v_status NOT IN \('pending_parent_preapproval', 'active'\)/);
  assert.match(linker, /IF v_status <> 'pending_parent_preapproval' THEN/);
  assert.doesNotMatch(linker, /SET account_status = 'pending_parent_preapproval'/);
});
test('STATIC_CONTRACT missing authoritative clock cannot grant a new linking window', () => {
  assert.match(linker, /COALESCE\(v_pending_preapproval_since, v_created_at\) IS NULL THEN\s*RETURN jsonb_build_object\('linked', false, 'reason', 'preapproval_clock_unavailable'\)/);
});
test('STATIC_CONTRACT all three original relation queries retain exact authorization and integrity conditions', () => {
  const queries = source => [...source.matchAll(/(?:SELECT cp\.id INTO v_matched_id|UPDATE public\.child_profiles cp)[\s\S]*?;/g)].map(x => clean(x[0]));
  assert.deepEqual(queries(linker), queries(historical.split('AS $link$')[1].split('$link$;')[0]));
  assert.equal(queries(linker).length, 3);
});
test('STATIC_CONTRACT both activation branches use wall-clock deadline after relation locks', () => {
  const updates = [...linker.matchAll(/SET account_status = CASE[\s\S]*?RETURNING account_status INTO v_status;/g)];
  assert.equal(updates.length, 2);
  for (const update of updates) {
    assert.match(update[0], /COALESCE\(pending_preapproval_since, created_at\) <= clock_timestamp\(\) - interval '7 days'/);
    assert.match(update[0], /THEN 'expired_pending_preapproval'\s+ELSE 'active'/);
    assert.match(update[0], /account_status = 'pending_parent_preapproval'/);
  }
});
test('STATIC_CONTRACT a deadline crossed during binding rolls tentative relation write back before expiry return', () => {
  assert.match(linker, /BEGIN\s+UPDATE public\.child_profiles cp/);
  assert.match(linker, /IF v_status = 'expired_pending_preapproval' THEN[\s\S]*?RAISE EXCEPTION 'Preapproval window expired' USING ERRCODE = 'P1307'/);
  assert.match(linker, /EXCEPTION WHEN SQLSTATE 'P1307' THEN\s+UPDATE public\.profiles SET account_status = 'expired_pending_preapproval'/);
});
test('STATIC_CONTRACT linker never resets the clock, and browser updates preserve both original timestamps', () => {
  assert.doesNotMatch(linker, /(?:pending_preapproval_since|created_at)\s*=/);
  assert.match(timer, /current_user IN \('anon', 'authenticated'\) AND OLD\.age_band = 'under_13'/);
  assert.match(timer, /NEW\.pending_preapproval_since := OLD\.pending_preapproval_since/);
  assert.match(timer, /NEW\.created_at := OLD\.created_at/);
});
test('STATIC_CONTRACT linker ACL remains authenticated/service-only with original signature', () => {
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.link_child_account\(\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.link_child_account\(\) TO authenticated, service_role/);
  assert.match(sql, /ALTER FUNCTION public\.link_child_account\(\) OWNER TO postgres/);
});
test('STATIC_CONTRACT no physical deletion, residual gate, leases, fencing or deletion trigger remains', () => {
  assert.doesNotMatch(sql, /\b(?:DELETE FROM|TRUNCATE|DROP TABLE)\b|deleteUser|under13_cleanup_leases|claim_token|under13_cleanup_gate|guard_under13_retention_delete/i);
  assert.doesNotMatch(sql, /profiles\.email|btrim\(p\.email\)/);
  assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE FROM|INSERT INTO)\s+(?:storage\.objects|public\.(?:payment_events|admin_plan_actions))\b/i);
});
test('STATIC_CONTRACT internal cron runs the bounded RPC every 15 minutes without HTTP/Vault', () => {
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS pg_cron/);
  assert.match(sql, /cron\.schedule\('omninauka-expire-under13-pending', '\*\/15 \* \* \* \*',\s*'SELECT public\.expire_pending_under13_accounts\(20\);'/);
  assert.match(sql, /WHERE jobname = 'omninauka-expire-under13-pending'/);
  assert.match(sql, /cron\.unschedule\(v_job\)/);
  assert.doesNotMatch(sql, /CREATE EXTENSION[^;]*(?:pg_net|supabase_vault)|net\.http_post|vault\.decrypted_secrets|CLEANUP_UNDER13_SCHEDULER_SECRET/);
});
test('STATIC_CONTRACT migration is transactional, functions replace safely and no registry operations exist', () => {
  assert.match(sql, /\nBEGIN;/); assert.match(sql, /COMMIT;\s*$/);
  assert.equal([...sql.matchAll(/CREATE OR REPLACE FUNCTION/g)].length, 4);
  assert.doesNotMatch(sql, /supabase_migrations|migration repair|migration up|db push/);
});
test('STATIC_CONTRACT expiry Edge worker is absent and prior config is preserved', async () => {
  await assert.rejects(access(new URL('supabase/functions/cleanup-under13-pending/index.ts', root)), { code: 'ENOENT' });
  const before = execFileSync('git', ['show', 'HEAD:supabase/config.toml'], { encoding: 'utf8' });
  // PRIV-01.1 adds a separate scheduler-authenticated email worker. Permit only
  // its exact section; the expiry architecture and every prior setting stay frozen.
  const normalized = config.replaceAll('\r\n', '\n');
  const reminderSection = '\n[functions.send-under13-parent-reminders]\n# Internal scheduler secret is checked before all privileged work.\nverify_jwt = false';
  assert.equal(normalized.split(reminderSection).length, 2);
  assert.equal(normalized.replace(reminderSection, '').trim(),
    before.replaceAll('\r\n', '\n').replace(reminderSection, '').trim());
});
test('STATIC_CONTRACT Storage state helper requires current auth profile under SHARE lock', () => {
  assert.match(upload, /IF auth\.uid\(\) IS NULL THEN RETURN false/);
  assert.match(upload, /FROM public\.profiles p\s+WHERE p\.id = auth\.uid\(\)\s+FOR SHARE OF p/);
  assert.match(upload, /IF NOT FOUND THEN RETURN false/);
  assert.match(sql, /can_upload_study_materials\(\)\s*RETURNS boolean\s*LANGUAGE plpgsql\s*VOLATILE\s*SECURITY DEFINER\s*SET search_path = public/);
  assert.deepEqual(uploadStates, ['active', 'parent_approved']);
});
test('STATIC_CONTRACT Storage INSERT and both UPDATE predicates preserve namespace plus live profile check', () => {
  for (const name of ['study_materials_insert_account_guard', 'study_materials_update_account_guard']) {
    const policy = sql.split('CREATE POLICY ' + name + ' ON storage.objects')[1].split(';')[0];
    assert.match(policy, /AS RESTRICTIVE FOR (?:INSERT|UPDATE) TO authenticated/);
    const count = name.includes('insert') ? 1 : 2;
    assert.equal([...policy.matchAll(/public\.can_upload_study_materials\(\)/g)].length, count);
    assert.equal([...policy.matchAll(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/g)].length, count);
    assert.equal([...policy.matchAll(/bucket_id <> 'study-materials' OR/g)].length, count);
    assert.match(policy, /WITH CHECK/);
    if (count === 2) assert.match(policy, /USING/);
  }
});
test('STATIC_CONTRACT Storage ownership/read/delete policies and other buckets remain intact', () => {
  assert.doesNotMatch(sql, /DROP POLICY[^;]*study_materials_(?:insert|update|select|delete)_(?:own_folder|legacy_owned)/);
  assert.doesNotMatch(sql, /FOR (?:DELETE|SELECT) TO authenticated/);
  assert.match(sql, /bucket_id <> 'study-materials' OR/);
});

for (const [label, offset, expected] of [
  ['one millisecond before seven days', 1, false], ['exactly seven days', 0, true],
  ['one millisecond past seven days', -1, true], ['three days is not expiry', windowMs - 3 * 86400000, false],
]) test('POLICY_MODEL deadline: ' + label, () => {
  assert.equal(eligible(profile({ createdAt: now - windowMs + offset })), expected);
});
for (const age of ['13_15', '16_17', '18_plus', 'parent', null]) {
  test('POLICY_MODEL expiry excludes age ' + age, () => assert.equal(eligible(profile({ age })), false));
}
for (const status of ['active', 'parent_approved', 'expired_pending_preapproval', 'suspended', 'parent_withdrawn', null]) {
  test('POLICY_MODEL expiry excludes status ' + status, () => assert.equal(eligible(profile({ status })), false));
}
test('POLICY_MODEL trusted valid link excludes expiry', () => assert.equal(eligible(profile({ trusted: true })), false));
test('POLICY_MODEL pending timestamp takes precedence and NULL falls back to creation', () => {
  assert.equal(eligible(profile({ createdAt: now - 30 * 86400000, pendingSince: now - 86400000 })), false);
  assert.equal(eligible(profile({ pendingSince: null })), true);
});
test('POLICY_MODEL missing both timestamps denies linking without fabricating a clock', () => {
  const p = profile({ createdAt: null, pendingSince: null });
  assert.equal(eligible(p), false);
  assert.equal(linkModel(p).linked, false);
  assert.deepEqual(linkModel(p).profile, p);
});
test('POLICY_MODEL expiry preserves original timestamps and is repeat-safe', () => {
  const original = profile({ pendingSince: now - windowMs });
  const first = expireModel(original);
  assert.equal(first.status, 'expired_pending_preapproval');
  assert.equal(first.createdAt, original.createdAt); assert.equal(first.pendingSince, original.pendingSince);
  assert.deepEqual(expireModel(first), first);
});
test('POLICY_MODEL valid preapproval can link before the deadline', () => {
  assert.equal(linkModel(profile({ createdAt: now - windowMs + 1 })).linked, true);
});
test('POLICY_MODEL no preapproval cannot activate even within the window', () => {
  assert.equal(linkModel(profile({ createdAt: now - windowMs + 1 }), { valid: false }).linked, false);
});
test('POLICY_MODEL scheduler delay never extends linking after the deadline', () => {
  const result = linkModel(profile({ createdAt: now - 30 * 86400000 }));
  assert.equal(result.linked, false); assert.equal(result.profile.status, 'expired_pending_preapproval');
});
test('POLICY_MODEL crossing the deadline while waiting for relation lock refuses activation', () => {
  const result = linkModel(profile({ createdAt: now - windowMs + 1 }), { at: now, finalAt: now + 2 });
  assert.equal(result.linked, false); assert.equal(result.profile.status, 'expired_pending_preapproval');
});
test('POLICY_MODEL serialized link-wins preserves active account in later expiry', () => {
  const linked = linkModel(profile({ createdAt: now - windowMs + 1 }));
  assert.equal(expireModel(linked.profile, now + 2).status, 'active');
});
test('POLICY_MODEL serialized expiry-wins cannot be undone by a later valid preapproval', () => {
  const expired = expireModel(profile());
  const result = linkModel(expired);
  assert.equal(result.linked, false); assert.equal(result.profile.status, 'expired_pending_preapproval');
});
for (const status of ['pending_parent_preapproval', 'expired_pending_preapproval', 'pending_parent_consent', 'suspended', 'parent_withdrawn', null, 'unknown']) {
  test('POLICY_MODEL Storage denies status ' + status, () => assert.equal(uploadModel({ status }), false));
}
test('POLICY_MODEL missing profile denies Storage even with a valid identity token', () => assert.equal(uploadModel(null), false));
for (const status of ['active', 'parent_approved']) {
  test('POLICY_MODEL Storage preserves legitimate account state ' + status, () => assert.equal(uploadModel({ status }), true));
}
for (const [label, text] of [['Privacy', privacy], ['Terms', terms], ['PL', plText], ['EN', enText]]) {
  test('STATIC_COPY ' + label + ' uses seven days and no legacy threshold or immediate-deletion promise', () => {
    assert.match(text, label === 'EN' ? /within 7 days of registration/ : /w ciągu 7 dni od rejestracji/);
    assert.doesNotMatch(text, activePattern);
    assert.doesNotMatch(text, /Cykle odbywają się co 15 minut|Cycles run every 15 minutes|najbliższym cyklu retencji|next retention cycle/);
    assert.match(text, label === 'EN' ? /can no longer be activated through parental linking/ : /nie można go już aktywować przez powiązanie/);
    assert.match(text, label === 'EN' ? /applicable retention and deletion policy/ : /obowiązującymi zasadami retencji i usuwania danych/);
  });
}
test('STATIC_COPY all six PL/EN registration, pending and parent messages carry the same policy', () => {
  const values = value => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(values) : [];
  assert.equal(values(JSON.parse(plText)).filter(x => x.includes('w ciągu 7 dni od rejestracji')).length, 6);
  assert.equal(values(JSON.parse(enText)).filter(x => x.includes('within 7 days of registration')).length, 6);
});
test('STATIC_CONTRACT active source has no legacy retention rule', async () => {
  const walk = async dir => {
    const result = [];
    for (const entry of await readdir(new URL(dir + '/', root), { withFileTypes: true })) {
      const path = dir + '/' + entry.name;
      if (entry.isDirectory()) result.push(...await walk(path));
      else if (/\.(?:tsx?|json|html)$/.test(entry.name)) result.push(path);
    }
    return result;
  };
  for (const path of [...await walk('src'), ...await walk('supabase/functions')]) {
    assert.doesNotMatch(await read(path), activePattern, path);
  }
});
test('STATIC_CONTRACT historical migrations, unrelated payment files and dependencies are unchanged', () => {
  assertOnlyNormalizationChanges([
    'supabase/functions/stripe-webhook/index.ts',
  ]);
  const changed = execFileSync('git', ['diff', '--name-only', 'HEAD', '--',
    'supabase/functions/create-checkout',
    'package.json', 'package-lock.json'], { encoding: 'utf8' })
    .trim().split(/\r?\n/).filter(Boolean);
  assert.deepEqual(changed, [], 'Unrelated payment files and dependencies remain frozen');
});

// MOCKED_BEHAVIOR executes the actual UI linking handler, not a policy model.
const guardSource = await read('src/components/auth/ConsentGuard.tsx');
const guardAst = ts.createSourceFile('ConsentGuard.tsx', guardSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const findVariable = name => {
  let result;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(guardAst) === name) result = node;
    ts.forEachChild(node, visit);
  };
  visit(guardAst);
  assert.ok(result, name);
  return result;
};
test('STATIC_UI expired profile cannot pass the protected application guard', () => {
  assert.equal(guardAst.parseDiagnostics.length, 0);
  const states = findVariable('blockingStatuses').initializer.elements.map(node => node.text);
  assert.deepEqual(states, ['parent_withdrawn', 'suspended', 'withdrawn', 'under_13', 'expired_pending_preapproval']);
  assert.match(guardSource, /blockingStatuses\.includes\(user\.accountStatus\)/);
  assert.match(guardSource, /user\?\.accountStatus === 'expired_pending_preapproval'\s*\? t\('auth\.pending\.under13\.cleanupRule'\)/);
});
for (const [label, data, expectedRefresh] of [
  ['activation', { linked: true }, 1],
  ['expiry reported by linker', { linked: false, reason: 'preapproval_window_expired' }, 1],
  ['missing valid preapproval', { linked: false, reason: 'no_preapproval' }, 0],
  ['unavailable result', null, 0],
]) {
  test('MOCKED_BEHAVIOR UI refresh on ' + label, async () => {
    let refreshed = 0;
    const loading = [], attempted = [], rpcCalls = [];
    const handlerSource = 'const attemptLink = ' + findVariable('attemptLink').initializer.getText(guardAst) + ';';
    const js = ts.transpileModule(handlerSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    const handler = new Function('supabase', 'setIsLinking', 'consentDebug', 'refreshUser', 'setLinkAttempted', 'setExpiryConfirmed', 'linkAttemptStarted', js + '\nreturn attemptLink;')(
      { rpc: async name => { rpcCalls.push(name); return { data }; } },
      value => loading.push(value), () => {}, async () => { refreshed++; }, value => attempted.push(value),
      () => {}, { current: false },
    );
    await handler();
    assert.deepEqual(rpcCalls, ['link_child_account']);
    assert.equal(refreshed, expectedRefresh);
    assert.deepEqual(loading, [true, false]);
    assert.deepEqual(attempted, [true]);
  });
}

// MOCKED_COMPONENT / MOCKED_AUTH run production render, effect and refresh code.
// React hook scheduling and Supabase responses are local doubles. This proves
// the failure path without network access; it is not mounted-browser/DB proof.
const authSource = await read('src/lib/auth-context.tsx');
const authAst = ts.createSourceFile('auth-context.tsx', authSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const authInitializer = name => {
  let result;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(authAst) === name) result = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(authAst);
  assert.ok(result, name);
  return result.getText(authAst);
};
const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
}).outputText;
const mapper = new Function(compile('const mapSupabaseUser = ' + authInitializer('mapSupabaseUser')) + '\nreturn mapSupabaseUser;')();
const refreshCode = compile('const refreshUser = ' + authInitializer('refreshUser'));
const mergeCode = compile('const fetchAndMergeProfile = ' + authInitializer('fetchAndMergeProfile'));
const testUser = (overrides = {}) => ({
  id: 'synthetic-local-user', email: 'local@example.invalid', name: 'Local fixture',
  ageBand: 'under_13', accountStatus: 'pending_parent_preapproval', userRole: 'student',
  plan: 'free', schoolType: 'primary', educationLevel: 'primary', ...overrides,
});
const expiredResult = { linked: false, reason: 'preapproval_window_expired' };
const authHarness = ({ user = testUser(), profileResult = { data: null, error: { code: 'LOCAL_READ_FAILURE' } },
  authError = null, missing = false, demo = false, linkResult = expiredResult } = {}) => {
  // Match AuthProvider accepting an authenticated identity before loading its
  // profile. Execute the real helper in an isolated synthetic tab, not an
  // always-true scope stub that would hide stale-result regressions.
  const clientState = createClientStateFixture();
  if (user) clientState.helper.activateUserClientState(user.id);
  const { captureUserClientState } = clientState.helper;
  let state = { user, isAuthenticated: true, isLoading: false };
  let profileMissing = missing;
  const calls = { stateWrites: 0, profileReads: 0, links: 0, missingWrites: [], logs: [] };
  const sbUser = {
    id: user?.id, email: 'local@example.invalid', created_at: '2030-01-01T00:00:00Z',
    user_metadata: { ageBand: user?.ageBand, accountStatus: user?.accountStatus },
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: user ? sbUser : null }, error: authError }) },
    from(table) {
      assert.equal(table, 'profiles');
      return { select() { return { eq(column, id) {
        assert.equal(column, 'id'); assert.equal(id, user?.id);
        return { async maybeSingle() {
          calls.profileReads++;
          return typeof profileResult === 'function' ? profileResult() : profileResult;
        } };
      } }; } };
    },
    async rpc(name) {
      if (name === 'link_child_account') {
        calls.links++;
        return { data: linkResult };
      }
      assert.equal(name, 'get_my_effective_plan');
      return { data: null, error: null };
    },
  };
  const writeState = updater => { calls.stateWrites++; state = updater(state); };
  const writeMissing = value => { calls.missingWrites.push(value); profileMissing = value; };
  const refresh = new Function('supabase', 'state', 'isDemoMode', 'setState', 'setIsProfileMissing', 'mapSupabaseUser', 'console', 'captureUserClientState',
    refreshCode + '\nreturn refreshUser;')(client, state, demo, writeState, writeMissing, mapper,
      { error: (...args) => calls.logs.push(args) }, captureUserClientState);
  const merge = new Function('supabase', 'setState', 'setIsProfileMissing', 'setIsProfileLoading', 'mapSupabaseUser', 'authDebug', 'captureUserClientState',
    mergeCode + '\nreturn fetchAndMergeProfile;')(client, writeState, writeMissing, () => {}, mapper, () => {}, captureUserClientState);
  return { calls, client, clientState, refresh, merge: () => merge(sbUser, true),
    get state() { return state; }, get isProfileMissing() { return profileMissing; } };
};
const guardDeclaration = guardAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ConsentGuard');
assert.ok(guardDeclaration);
const guardCode = compile(guardDeclaration.getText(guardAst)
  .replace('export function', 'function').replace('import.meta.env.DEV', 'false'));
const translations = JSON.parse(plText);
const translated = key => key.split('.').reduce((value, part) => value?.[part], translations) ?? key;
const settle = () => new Promise(resolve => setImmediate(resolve));
const componentHarness = (auth, { requireApproval = true, replayEffects = false } = {}) => {
  const slots = [], effects = [];
  let cursor = 0;
  const useState = initial => {
    const slot = cursor++;
    if (!Object.hasOwn(slots, slot)) slots[slot] = initial;
    return [slots[slot], value => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value; }];
  };
  const useRef = initial => {
    const slot = cursor++;
    if (!Object.hasOwn(slots, slot)) slots[slot] = { current: initial };
    return slots[slot];
  };
  const useEffect = (effect, deps) => {
    const slot = cursor++;
    const changed = !slots[slot] || deps.some((value, i) => !Object.is(value, slots[slot][i]));
    slots[slot] = deps;
    if (changed) effects.push(effect);
  };
  const noopIcon = () => null;
  const guard = new Function('React', 'useState', 'useRef', 'useEffect', 'useAuth', 'useTranslation',
    'supabase', 'window', 'ShieldAlert', 'Loader2', 'LogOut', 'Navigate', guardCode + '\nreturn ConsentGuard;')(
    React, useState, useRef, useEffect,
    () => ({ ...auth.state, isProfileLoading: false, isProfileMissing: auth.isProfileMissing,
      // A new callback identity on rerender must not start another link attempt.
      refreshUser: () => auth.refresh(), logout: () => {} }),
    () => ({ t: translated }), auth.client, { location: { search: '', pathname: '/app' } },
    noopIcon, noopIcon, noopIcon, ({ to }) => React.createElement('a', { 'data-redirect': to }),
  );
  return {
    render() {
      cursor = 0;
      return renderToStaticMarkup(guard({ requireApproval,
        children: React.createElement('div', null, 'PROTECTED_APP_SENTINEL') }));
    },
    async flush() {
      for (const effect of effects.splice(0)) {
        effect();
        if (replayEffects) effect(); // Replay the same effect closure as in StrictMode.
      }
      await settle();
    },
  };
};
const assertBlocked = html => {
  assert.doesNotMatch(html, /PROTECTED_APP_SENTINEL/);
  assert.match(html, /Dostęp zablokowany/);
  assert.match(html, /Wyloguj się/);
};
for (const boundary of ['logout', 'account_switch']) {
  test('MOCKED_AUTH harness rejects a late profile refresh after ' + boundary, async () => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const h = authHarness({ profileResult: () => pending });
    const before = h.state.user;
    const refresh = h.refresh();
    await settle();
    assert.equal(h.calls.profileReads, 1);
    if (boundary === 'logout') h.clientState.helper.clearUserClientState('logout');
    else h.clientState.helper.activateUserClientState('another-synthetic-user');
    release({ data: { account_status: 'active', age_band: '18_plus' }, error: null });
    assert.deepEqual(await refresh, { success: false, reason: 'auth_unavailable' });
    assert.equal(h.state.user, before);
    assert.equal(h.calls.stateWrites, 0);
    assert.deepEqual(h.calls.missingWrites, []);
  });
}
for (const [label, result] of [
  ['null data with query error', { data: null, error: { code: 'LOCAL_READ_FAILURE' } }],
  ['data accompanied by query error', { data: { account_status: 'active' }, error: { code: 'LOCAL_READ_FAILURE' } }],
  ['rejected profile read', () => { throw new Error('local read failure'); }],
]) test('MOCKED_AUTH refresh preserves every last-trusted field on ' + label, async () => {
  const h = authHarness({ profileResult: result });
  const before = h.state.user;
  assert.deepEqual(await h.refresh(), { success: false, reason: 'profile_refresh_failed' });
  assert.equal(h.state.user, before);
  assert.equal(h.calls.stateWrites, 0);
  assert.equal(h.isProfileMissing, false);
  assert.deepEqual(h.calls.missingWrites, []);
  assert.deepEqual(h.calls.logs, []);
});
test('MOCKED_AUTH genuine missing profile has its own result and blocks existing active access', async () => {
  const h = authHarness({ user: testUser({ ageBand: '18_plus', accountStatus: 'active' }),
    profileResult: { data: null, error: null } });
  assert.deepEqual(await h.refresh(), { success: false, reason: 'profile_missing' });
  assert.equal(h.calls.stateWrites, 0);
  assert.equal(h.isProfileMissing, true);
  assertBlocked(componentHarness(h).render());
});
test('MOCKED_AUTH successful profile refresh clears a previously confirmed missing-profile block', async () => {
  const h = authHarness({ missing: true, profileResult: {
    data: { age_band: 'under_13', account_status: 'expired_pending_preapproval', user_role: 'student' }, error: null,
  } });
  assert.deepEqual(await h.refresh(), { success: true });
  assert.equal(h.isProfileMissing, false);
  assert.equal(h.state.user.accountStatus, 'expired_pending_preapproval');
});
test('MOCKED_AUTH Auth lookup failure preserves trusted state and never queries the profile', async () => {
  const h = authHarness({ authError: { code: 'LOCAL_AUTH_FAILURE' } });
  assert.deepEqual(await h.refresh(), { success: false, reason: 'auth_unavailable' });
  assert.equal(h.calls.profileReads, 0);
  assert.equal(h.calls.stateWrites, 0);
});
for (const [label, result, expectedMissing] of [
  ['error', { data: null, error: { code: 'LOCAL_READ_FAILURE' } }, false],
  ['missing row', { data: null, error: null }, true],
]) test('MOCKED_AUTH initial profile merge distinguishes ' + label, async () => {
  const h = authHarness({ profileResult: result });
  await h.merge();
  assert.equal(h.isProfileMissing, expectedMissing);
  assert.equal(h.calls.stateWrites, 0);
});
test('MOCKED_COMPONENT exact FR01: expiry plus actual failed refresh stays blocked without link retries', async () => {
  const h = authHarness();
  const ui = componentHarness(h, { replayEffects: true });
  assert.doesNotMatch(ui.render(), /PROTECTED_APP_SENTINEL/);
  await ui.flush();
  assert.equal(h.state.user.accountStatus, 'pending_parent_preapproval');
  for (let i = 0; i < 6; i++) {
    const html = ui.render();
    assertBlocked(html);
    assert.match(html, /7 dni/);
    assert.match(html, /nie można go już aktywować/);
    await ui.flush();
  }
  assert.equal(h.calls.links, 1);
  assert.equal(h.calls.profileReads, 1);
  assert.equal(h.calls.stateWrites, 0);
});
test('MOCKED_COMPONENT confirmed expiry blocks before a deferred profile refresh completes', async () => {
  let release;
  const readPending = new Promise(resolve => { release = resolve; });
  const h = authHarness({ profileResult: () => readPending });
  const ui = componentHarness(h);
  ui.render(); await ui.flush();
  assert.equal(h.calls.profileReads, 1);
  assert.match(ui.render(), /nie można go już aktywować/);
  assertBlocked(ui.render());
  release({ data: null, error: { code: 'LOCAL_READ_FAILURE' } });
  await settle();
  assertBlocked(ui.render());
  await ui.flush();
  assert.equal(h.calls.links, 1);
});
test('MOCKED_COMPONENT successful refresh after expiry remains blocked, including a fresh guard mount', async () => {
  const h = authHarness({ profileResult: {
    data: { age_band: 'under_13', account_status: 'expired_pending_preapproval', user_role: 'student' }, error: null,
  } });
  const ui = componentHarness(h);
  ui.render(); await ui.flush();
  assert.equal(h.state.user.accountStatus, 'expired_pending_preapproval');
  assertBlocked(ui.render());
  const fresh = componentHarness(h);
  assertBlocked(fresh.render()); await fresh.flush();
  assert.equal(h.calls.links, 1);
});
for (const status of [undefined, null, 'unknown']) {
  test('MOCKED_COMPONENT known under13 fails closed for unavailable status ' + status, async () => {
    const h = authHarness({ user: testUser({ accountStatus: status }) });
    const ui = componentHarness(h);
    assertBlocked(ui.render()); await ui.flush();
    assert.equal(h.calls.links, 0);
  });
}
test('MOCKED_COMPONENT under13 pending before deadline stays pending after no valid preapproval', async () => {
  const h = authHarness({ linkResult: { linked: false, reason: 'no_preapproval' } });
  const ui = componentHarness(h);
  assert.doesNotMatch(ui.render(), /PROTECTED_APP_SENTINEL/); await ui.flush();
  assert.match(ui.render(), /Poproś rodzica/);
  assert.doesNotMatch(ui.render(), /PROTECTED_APP_SENTINEL/); await ui.flush();
  assert.equal(h.calls.links, 1);
  assert.equal(h.calls.profileReads, 0);
});
for (const [label, user] of [
  ['active linked under13', testUser({ accountStatus: 'active' })],
  ['13–15 approved', testUser({ ageBand: '13_15', accountStatus: 'parent_approved' })],
  ['adult', testUser({ ageBand: '18_plus', accountStatus: 'active' })],
  ['parent', testUser({ ageBand: '18_plus', accountStatus: 'active', userRole: 'parent' })],
  ['adult without optional status', testUser({ ageBand: '18_plus', accountStatus: undefined })],
  ['parent without optional status', testUser({ ageBand: '18_plus', accountStatus: undefined, userRole: 'parent' })],
]) test('MOCKED_COMPONENT regression preserves ' + label, async () => {
  const h = authHarness({ user });
  const ui = componentHarness(h);
  assert.match(ui.render(), /PROTECTED_APP_SENTINEL/); await ui.flush();
  assert.equal(h.calls.links, 0);
});
test('MOCKED_COMPONENT 13–15 pending consent still redirects', async () => {
  const h = authHarness({ user: testUser({ ageBand: '13_15', accountStatus: 'pending_parent_consent' }) });
  const ui = componentHarness(h);
  assert.match(ui.render(), /data-redirect="\/pending-consent"/);
  assert.doesNotMatch(ui.render(), /PROTECTED_APP_SENTINEL/); await ui.flush();
  assert.equal(h.calls.links, 0);
});
test('MOCKED_COMPONENT approval opt-out does not apply the under13 unknown-status restriction', async () => {
  const h = authHarness({ user: testUser({ accountStatus: undefined }) });
  const ui = componentHarness(h, { requireApproval: false });
  assert.match(ui.render(), /PROTECTED_APP_SENTINEL/); await ui.flush();
  assert.equal(h.calls.links, 0);
});
