import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20261010174000_priv02_legacy_storage_owner.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('legacy owner RPC: SECURITY DEFINER with empty search_path, schema-qualified', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.get_storage_object_owner\(p_bucket_id text, p_name text\)/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path = ''/);
  assert.match(sql, /FROM storage\.objects AS o/);
  assert.match(sql, /o\.bucket_id = p_bucket_id/);
  assert.match(sql, /o\.name = p_name/);
  assert.match(sql, /AS \$\$/);
});

test('legacy owner RPC: PUBLIC/anon/authenticated revoked, service_role only', () => {
  for (const role of ['PUBLIC', 'anon', 'authenticated']) {
    assert.match(sql, new RegExp('REVOKE ALL ON FUNCTION public\\.get_storage_object_owner\\(text, text\\) FROM ' + role + ';'));
  }
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_storage_object_owner\(text, text\) TO service_role;/);
  assert.equal((sql.match(/GRANT /g) || []).length, 1);
});
