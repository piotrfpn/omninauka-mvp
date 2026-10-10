import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { normalizationContract as contract, hash, assertArchivedMigrationsUnchanged } from './helpers/migration-provenance.mjs';

// STATIC_VALIDATION only. SQL parsing, C0/C1 and PostgreSQL RLS execution are
// deferred to MIG-HIST-01D.2 on a dedicated empty Supabase database.
const root = new URL('../', import.meta.url);
const active = new URL('supabase/migrations/', root);
const read = p => readFileSync(new URL(p, root), 'utf8');
const baseline = read('supabase/migrations/' + contract.baseline_file);
const priv02 = read('supabase/migrations/' + contract.priv02_file);
const manifest = read('docs/database/MIGRATION_BASELINE_2026.md');
const versions = ['20260427170350','20260427170359','20260428183903','20260428202546',
  '20260502113939','20260502114959','20260502120308','20260502182210',
  '20260509100602','20260509142243','20260510183007'];
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalize = s => s.replace(/\r\n/g, '\n').trim();
test('STATIC_BASELINE Git preserves exact active and archived migration bytes', () => {
  const attributes = read('.gitattributes');
  assert.match(attributes, /^supabase\/migrations\/\*\.sql -text$/m);
  assert.match(attributes, /^supabase\/migration_archive\/legacy_pre_baseline\/\*\.sql -text$/m);
});
function block(kind, name) {
  const re = new RegExp(`^-- BEGIN CANONICAL ${escape(kind)} ${escape(name)}\\n([\\s\\S]*?)\\n-- END CANONICAL ${escape(kind)} ${escape(name)}$`, 'm');
  const match = baseline.match(re);
  assert.ok(match, `${kind} ${name}`);
  return match[1];
}
const tables = ['admin_plan_actions','child_profiles','folders','parental_consents','payment_events',
  'profiles','session_images','study_sessions','support_tickets','tutor_messages','tutor_threads',
  'under13_parent_notifications','usage_events'];

test('STATIC_BASELINE exactly 11 anchors + ordered B/P, no active sequential migration', () => {
  const names = readdirSync(active).sort();
  assert.deepEqual(names, [...versions.map(v => v + '_history_anchor.sql'), contract.baseline_file, contract.priv02_file].sort());
  assert.equal(names.length, 13);
  assert.ok(names.every(n => /^\d{14}_\w+\.sql$/.test(n)));
  const b = contract.baseline_file.split('_')[0];
  const p = contract.priv02_file.split('_')[0];
  assert.ok(b > versions.at(-1) && p > b);
});

test('STATIC_BASELINE anchors contain comments only and preserve exact remote provenance', () => {
  const mappings = ['00009','00010','00011','00012','00016','00017','00018','00019','00060','00061','00066'];
  for (const [i, v] of versions.entries()) {
    const anchor = read('supabase/migrations/' + v + '_history_anchor.sql');
    assert.ok(anchor.split(/\r?\n/).every(line => !line.trim() || line.startsWith('--')));
    assert.ok(anchor.includes('Remote migration version: ' + v));
    assert.ok(anchor.includes('Remote migration name: '));
    assert.ok(anchor.includes('Mapped legacy migration: ' + mappings[i] + '_'));
    assert.ok(anchor.includes('supabase/migration_archive/legacy_pre_baseline/' + mappings[i] + '_'));
    assert.ok(anchor.includes('DO NOT REPLAY historical SQL'));
  }
});

test('STATIC_BASELINE archive bytes and all 42 manifest dispositions remain deterministic', () => {
  assertArchivedMigrationsUnchanged();
  const versions = contract.archived.map(r => r.version);
  assert.deepEqual(versions, [...Array.from({length:19},(_,i)=>String(i+1).padStart(5,'0')),
    ...Array.from({length:23},(_,i)=>String(i+60).padStart(5,'0'))]);
  for(const r of contract.archived) {
    assert.match(r.sha256, /^[A-F0-9]{64}$/);
    assert.ok(['REPRESENTED','SUPERSEDED','OBSOLETE','REPLAY_PROHIBITED'].includes(r.classification));
    assert.ok(r.purpose && r.replacement && r.remote);
  }
  const old = contract.archived.find(r=>r.version==='00013');
  assert.equal(old.classification,'OBSOLETE');
  assert.match(old.replacement,/REPLAY_PROHIBITED/);
  for(const token of ['OBSOLETE_SCHEMA_INTENT','EXECUTION_NOT_PROVEN','LIVE_EFFECT_ABSENT','CANONICAL_REQUIREMENT_NO']) assert.ok(manifest.includes(token));
});

test('STATIC_BASELINE reviewed object blocks retain source checksums, complete inventory and no extra SQL', () => {
  assert.equal(hash(readFileSync(new URL('supabase/migrations/' + contract.baseline_file, root))), contract.baseline_sha256);
  const found = [...baseline.matchAll(/^-- BEGIN CANONICAL (\w+) (.+)$/gm)].map(m=>[m[1],m[2]]);
  assert.deepEqual(found, contract.blocks.map(b=>[b.kind,b.name]));
  for(const b of contract.blocks) assert.equal(hash(normalize(block(b.kind,b.name))),b.sha256, `${b.kind} ${b.name}`);
  assert.equal(found.filter(([k])=>k==='TABLE').length,13);
  assert.equal(found.filter(([k])=>k==='CONSTRAINT').length,64);
  assert.equal(found.filter(([k])=>k==='FUNCTION').length,24);
  assert.equal(found.filter(([k])=>k==='TRIGGER').length,9);
  assert.equal(found.filter(([k])=>k==='VIEW').length,1);
  assert.equal(found.filter(([k])=>k==='POLICY').length,31);
  assert.equal(found.filter(([k])=>k==='RLS').length,13);
  assert.equal([...baseline.matchAll(/^CREATE TABLE public\."/gm)].length,13);
  assert.equal(tables.reduce((n,t)=>n+[...block('TABLE',t).matchAll(/^  "\w+" /gm)].length,0),165);
  const constraintIndexes = contract.blocks.filter(b=>b.kind==='CONSTRAINT' && /ADD CONSTRAINT[^;]*\b(?:PRIMARY KEY|UNIQUE)\b/.test(block(b.kind,b.name)));
  assert.equal(found.filter(([k])=>k==='INDEX').length + constraintIndexes.length,45);
  assert.deepEqual(contract.expected_tables,tables);
});

test('STATIC_BASELINE profile/child canonical model and ownership-only pre-PRIV02 session graph', () => {
  assert.doesNotMatch(block('TABLE','profiles'), /last_login_at/);
  const child = block('TABLE','child_profiles');
  for(const c of ['child_email','child_email_normalized','child_user_id']) assert.match(child,new RegExp(`"${c}" (?:text|uuid)(?:,|\\n)`));
  assert.match(block('INDEX','idx_child_profiles_unique_email_per_parent'),/UNIQUE.*\(parent_user_id, child_email_normalized\).*WHERE \(child_email_normalized IS NOT NULL\)/s);
  assert.match(block('CONSTRAINT','child_profiles_child_user_id_fkey'),/ON DELETE SET NULL/);
  assert.match(block('CONSTRAINT','child_profiles_parent_user_id_fkey'),/ON DELETE CASCADE/);
  assert.match(block('FUNCTION','protect_child_profile_authorization'), /NEW\.child_email IS NULL/);
  const sessions = contract.blocks.filter(b=>b.kind==='POLICY' && /ON "public"\."study_sessions"/.test(block(b.kind,b.name)));
  assert.equal(sessions.length,3);
  assert.deepEqual(sessions.map(b=>block(b.kind,b.name).match(/FOR (\w+) TO/)[1]).sort(),['INSERT','SELECT','UPDATE']);
  for(const p of sessions) assert.match(block(p.kind,p.name),/auth\.uid\(\) = user_id/);
  assert.doesNotMatch(baseline,/CREATE POLICY "?priv02_active_/);
});

test('STATIC_BASELINE final function definitions and explicit EXECUTE ACLs preserve live privilege boundaries', () => {
  assert.equal(contract.functions.length,24);
  assert.equal(contract.functions.filter(f=>f.definer).length,17);
  for(const f of contract.functions) {
    const definition=block('FUNCTION',f.name);
    assert.equal(hash(normalize(definition)),f.definition_sha256);
    assert.equal(f.owner,'postgres');
    assert.match(definition,new RegExp(`LANGUAGE ${f.language}`));
    if(f.definer) {
      assert.match(definition,/SECURITY DEFINER/);
      assert.match(definition,/SET search_path TO 'public'/);
      assert.deepEqual(f.config,['search_path=public']);
    } else assert.doesNotMatch(definition,/\n SECURITY DEFINER/);
    const acl=block('FUNCTION_ACL',f.name);
    assert.match(acl,/REVOKE ALL PRIVILEGES ON FUNCTION .* FROM PUBLIC, anon, authenticated, service_role, postgres;/);
    const roles=[...acl.matchAll(/GRANT EXECUTE ON FUNCTION [^;]+ TO (PUBLIC|"[^"]+");/g)].map(m=>m[1].replaceAll('"','')).sort();
    assert.deepEqual(roles,f.execute_roles,f.name);
  }
  assert.doesNotMatch(block('TABLE_ACL','profiles'),/GRANT[^;]*INSERT[^;]*TO "(?:anon|authenticated)"/);
  assert.doesNotMatch(block('TABLE_ACL','parental_consents'),/GRANT[^;]*TO "(?:anon|authenticated)"/);
  assert.doesNotMatch(block('VIEW_ACL','v_under13_pending_cleanup_candidates'),/GRANT[^;]*TO "(?:anon|authenticated)"/);
});

test('STATIC_BASELINE Storage ownership, implicit UPDATE check and restrictive account guards remain intact', () => {
  const storage=contract.blocks.filter(b=>b.kind==='POLICY' && /ON "storage"\."objects"/.test(block(b.kind,b.name)));
  assert.equal(storage.length,10);
  for(const name of ['study_materials_select_legacy_owned','study_materials_delete_legacy_owned']) {
    const s=block('POLICY',name);
    assert.match(s,/uploads\/%/); assert.match(s,/owner_id = \(auth\.uid\(\)\)::text/);
    assert.doesNotMatch(s,/session_images|study_sessions/);
  }
  for(const name of ['study_materials_insert_account_guard','study_materials_update_account_guard']) {
    const s=block('POLICY',name);
    assert.match(s,/AS RESTRICTIVE/); assert.match(s,/WITH CHECK/);
    assert.match(s,/storage\.foldername\(name\)/); assert.match(s,/can_upload_study_materials\(\)/);
  }
  const own=storage.filter(p=>p.name.includes('own_folder'));
  assert.equal(own.length,6);
  for(const p of own) assert.match(block(p.kind,p.name),/storage\.foldername\(name\)\)\[1\] = \(auth\.uid\(\)\)::text/);
  assert.match(block('FUNCTION','can_upload_study_materials'), /v_status IN \('active', 'parent_approved'\)/);
});

test('STATIC_BASELINE bucket/realtime/database-only cron are explicit; external delivery is omitted', () => {
  assert.match(block('BUCKET','study-materials'),/VALUES \('study-materials', 'study-materials', false, NULL, NULL\)/);
  assert.match(block('BUCKET','study-materials'),/ON CONFLICT \(id\) DO UPDATE/);
  assert.match(block('REALTIME','session_images'),/IF NOT EXISTS/);
  assert.match(block('REALTIME','session_images'),/ALTER PUBLICATION supabase_realtime ADD TABLE public\.session_images/);
  assert.match(block('TRIGGER','on_auth_user_created'),/AFTER INSERT ON auth\.users/);
  const cron=block('CRON','omninauka-expire-under13-pending');
  assert.match(cron,/\*\/15 \* \* \* \*/);
  assert.match(cron,/SELECT public\.expire_pending_under13_accounts\(20\);/);
  assert.doesNotMatch(baseline,/net\.http_post|vault\.decrypted_secrets|supabase\.co|omninauka-under13-parent-reminder-d5/);
});

test('STATIC_BASELINE high-risk secret/security scan and bootstrap replay refusal', () => {
  assert.doesNotMatch(baseline,/\bGRANT\s+ALL\b/i);
  assert.doesNotMatch(baseline,/eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}|(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{12,}/);
  assert.doesNotMatch(baseline,/'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/i);
  assert.doesNotMatch(baseline,/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  assert.doesNotMatch(baseline,/https?:\/\//i);
  assert.match(baseline,/Existing application schema: baseline SQL MUST NOT be replayed/);
  assert.match(baseline,/current_user <> 'postgres'/);
  assert.match(baseline,/SET LOCAL search_path = public, extensions/);
  assert.ok(normalize(baseline).endsWith('COMMIT;'));
});

test('STATIC_BASELINE PRIV02 remains byte-identical, four restrictive policies only, runtime pending', () => {
  const approved='2AE56530F39DE18C6DB4543E324FA318A4D96424D96A24ECE158AEE5FFAF9AF9';
  assert.equal(hash(readFileSync(new URL('supabase/migrations/'+contract.priv02_file,root))),approved);
  assert.equal(contract.priv02_sha256,approved);
  assert.equal([...priv02.matchAll(/CREATE POLICY priv02_active_/g)].length,4);
  assert.equal([...priv02.matchAll(/AS RESTRICTIVE FOR ALL TO authenticated/g)].length,4);
  assert.ok(manifest.includes('PENDING'));
});
