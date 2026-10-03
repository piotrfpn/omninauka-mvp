// STATIC_CONTRACT / MOCKED_RUNTIME only; no live Auth, RLS or PostgREST execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const edgePath = 'supabase/functions/admin-plan-management/index.ts';
const pagePath = 'src/pages/app/AdminPage.tsx';
const componentPath = 'src/components/admin/AdminUserDirectory.tsx';
const source = await readFile(new URL(`../${edgePath}`, import.meta.url), 'utf8');
const pageSource = await readFile(new URL(`../${pagePath}`, import.meta.url), 'utf8');
const uiSource = await readFile(new URL(`../${componentPath}`, import.meta.url), 'utf8');
const uuid = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const now = Date.now();
const future = new Date(now + 86400000).toISOString();
const expired = new Date(now - 86400000).toISOString();
const profile = (number, overrides = {}) => ({ id: uuid(number), email: `user${number}@example.invalid`, name: `Test ${number}`,
  created_at: '2026-01-01T00:00:00Z', user_role: 'student', age_band: '16_17', account_status: 'active', plan: 'free', plan_expires_at: null, ...overrides });
const relation = (overrides = {}) => ({ id: uuid(99), parent_user_id: uuid(1), child_user_id: uuid(2), status: 'linked',
  preapproval_integrity_version: 1, guardian_consent_acknowledged_at: '2026-01-01T00:00:00Z', guardian_consent_version: 'child_email_preapproval_v1', ...overrides });

function bootEdge(client, options = {}) {
  const js = ts.transpileModule(source.replace(/^import .*;\r?\n/gm, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  let handler;
  const calls = { clients: 0, auth: 0, logs: [] };
  new Function('serve', 'createClient', 'Deno', 'console', `${js}\nreturn { directoryInput, directoryUser, trustedDirectoryRelation };`)(
    fn => { handler = fn; },
    () => {
      calls.clients++;
      if (calls.clients === 1) return { auth: { async getUser() {
        calls.auth++;
        return { data: { user: options.noUser ? null : { id: uuid(900), email: options.email ?? 'admin@example.invalid', user_metadata: { user_role: 'admin' } } }, error: options.authError ?? null };
      } } };
      return client;
    },
    { env: { get: key => key === 'ADMIN_EMAILS' ? 'admin@example.invalid' : 'test-only-config' } },
    { error: (...args) => calls.logs.push(args), log() {} },
  );
  // Extracted declarations execute the same final source as the request handler.
  const helpers = new Function('serve', 'createClient', 'Deno', 'console', `${js}\nreturn { directoryInput, directoryUser, trustedDirectoryRelation };`)(() => {}, () => client, {}, console);
  return { handler, calls, ...helpers };
}

function mockDatabase(profiles = [], relations = [], authUsers = [], options = {}) {
  const calls = { queries: [], authPages: [] };
  const client = {
    from(table) {
      const log = { table, filters: [], orders: [] };
      calls.queries.push(log);
      const query = {
        select(columns, opts = {}) { log.columns = columns; log.options = opts; return query; },
        eq(column, value) { log.filters.push(['eq', column, value]); return query; },
        in(column, values) { assert.ok(values.length); log.filters.push(['in', column, values]); return query; },
        or(value) { log.filters.push(['or', value]); return query; },
        order(column, config) { log.orders.push([column, config]); return query; },
        range(from, to) { log.range = [from, to]; return query; },
        limit(value) { log.limit = value; return query; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            if (options.throwQuery) throw new Error('private DB transport');
            if (options.queryError) return { data: null, count: null, error: { message: 'private SQL error' } };
            let rows = [...(table === 'profiles' ? profiles : relations)];
            for (const [operation, column, value] of log.filters) {
              if (operation === 'eq') rows = rows.filter(row => row[column] === value);
              if (operation === 'in') rows = rows.filter(row => value.includes(row[column]));
              if (operation === 'or') {
                if (column === 'user_role.is.null,user_role.not.in.(parent,student)') rows = rows.filter(row => !['parent', 'student'].includes(row.user_role));
                else if (column === 'age_band.neq.under_13,age_band.is.null') rows = rows.filter(row => row.age_band !== 'under_13');
                else if (table === 'child_profiles') {
                  const ids = column.match(/parent_user_id\.in\.\(([^)]*)\)/)[1].split(',');
                  rows = rows.filter(row => ids.includes(row.parent_user_id) || ids.includes(row.child_user_id));
                } else assert.match(column, /^email\.ilike\.".*",name\.ilike\.".*"$/);
              }
            }
            for (const [column, config] of [...log.orders].reverse()) rows.sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (config.ascending ? 1 : -1));
            const count = rows.length;
            if (log.range) rows = rows.slice(log.range[0], log.range[1] + 1);
            if (log.limit) rows = rows.slice(0, log.limit);
            const columns = log.columns.split(',');
            return { data: log.options.head ? null : rows.map(row => Object.fromEntries(columns.map(column => [column, row[column]]))), count: log.options.count === 'exact' ? count : null, error: null };
          }).then(resolve, reject);
        },
      };
      return query;
    },
    auth: { admin: { async listUsers({ page, perPage }) {
      calls.authPages.push({ page, perPage });
      return { data: { users: authUsers.slice((page - 1) * perPage, page * perPage) }, error: options.authScanError ? { message: 'private auth error' } : null };
    } } },
  };
  return { client, calls };
}

async function request(body, database = mockDatabase(), auth = {}, headers = { Authorization: 'Bearer test-only-token' }) {
  const boot = bootEdge(database.client, auth);
  const response = await boot.handler(new Request('https://example.invalid/admin', { method: 'POST', headers, body: JSON.stringify(body) }));
  return { response, data: await response.json(), calls: database.calls, boot };
}
const helpers = bootEdge(mockDatabase().client);
const parents = new Map([[uuid(1), profile(1, { user_role: 'parent', plan: 'family', plan_expires_at: future })]]);
const child = profile(2, { age_band: 'under_13' });
const userDto = (user = child, links = [relation()], parentMap = parents) => helpers.directoryUser(user, links, parentMap, now);

for (const action of ['list_users', 'list_account_issues']) {
  for (const [label, auth, headers, status] of [
    ['no Authorization', {}, {}, 401], ['invalid JWT', { authError: { message: 'bad JWT' } }, undefined, 401],
    ['nonallowlisted admin metadata', { email: 'student@example.invalid' }, undefined, 403],
  ]) test(`MOCKED_RUNTIME ${action}: ${label} denies before service client/queries`, async () => {
    const result = await request({ action }, mockDatabase(), auth, headers);
    assert.equal(result.response.status, status);
    assert.ok(result.boot.calls.clients <= 1);
    assert.equal(result.calls.queries.length, 0);
    assert.equal(result.calls.authPages.length, 0);
  });
}
test('STATIC_CONTRACT both new actions follow JWT, ADMIN_EMAILS guard and service client creation', () => {
  const dispatch = source.indexOf("if (action === 'list_users' || action === 'list_account_issues')");
  for (const marker of ['userClient.auth.getUser()', "Deno.env.get('ADMIN_EMAILS')", 'if (!isAdmin)', 'const adminClient = createClient']) assert.ok(source.indexOf(marker) < dispatch);
  assert.match(source, /const isAdmin = adminEmails\.includes\(requestingEmail\)/);
});
test('STATIC_CONTRACT frontend holds no service key or cross-user DB reads', () => {
  for (const frontend of [pageSource, uiSource]) assert.doesNotMatch(frontend, /SERVICE_ROLE|service_role|\.from\(['"]profiles['"]\)|auth\.admin/);
});

for (const [field, invalid] of [
  ['page', [0, -1, 1.5, '1', null, Number.MAX_SAFE_INTEGER]],
  ['pageSize', [0, -1, 1.5, '25', null, 51]],
  ['typeFilter', ['admin', '', null]], ['ownPlanFilter', ['enterprise', '', null]],
  ['statusFilter', ['blocked', '', null]], ['search', ['x'.repeat(101), null, 1]],
]) for (const value of invalid) test(`MOCKED_RUNTIME invalid ${field}=${String(value)} yields 400 without queries`, async () => {
  const result = await request({ action: 'list_users', [field]: value });
  assert.equal(result.response.status, 400);
  assert.equal(result.calls.queries.length, 0);
});
for (const field of ['page', 'pageSize']) for (const value of [NaN, Infinity, -Infinity]) test(`MOCKED_RUNTIME validation rejects non-JSON ${field}=${value}`, () => {
  assert.equal(helpers.directoryInput({ [field]: value }), null);
});
test('MOCKED_RUNTIME defaults, maximum page size, wildcard removal and trimmed search', () => {
  assert.deepEqual(helpers.directoryInput({}), { page: 1, pageSize: 25, search: '', typeFilter: 'all', ownPlanFilter: 'all', statusFilter: 'all' });
  assert.equal(helpers.directoryInput({ pageSize: 50, search: ' %a_b* ' }).search, 'ab');
});
test('MOCKED_RUNTIME search safely quotes PostgREST punctuation; no raw filter structure', async () => {
  const result = await request({ action: 'list_users', search: 'a",id.neq.x)\\%' });
  assert.equal(result.response.status, 200);
  const filter = result.calls.queries[0].filters[0][1];
  assert.equal(filter, 'email.ilike."%a\\",id.neq.x)\\\\%",name.ilike."%a\\",id.neq.x)\\\\%"');
  let url;
  const sdk = createSupabaseClient('https://example.invalid', 'test-only-key', { global: { fetch: async input => {
    url = new URL(input); return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
  } } });
  await sdk.from('profiles').select('id').or(filter);
  assert.equal(url.searchParams.get('or'), `(${filter})`);
});

for (const [label, user, expected] of [
  ['parent', profile(1, { user_role: 'parent' }), 'parent'], ['under13', child, 'child_under_13'],
  ['student', profile(3), 'student'], ['student NULL age', profile(4, { age_band: null }), 'student'],
  ['NULL role', profile(5, { user_role: null }), 'unknown'], ['unexpected role', profile(6, { user_role: 'admin' }), 'unknown'],
]) test(`MOCKED_RUNTIME business classification ${label}`, () => assert.equal(userDto(user).businessType, expected));

for (const plan of ['premium', 'family']) for (const expiry of [null, future]) test(`MOCKED_RUNTIME own active ${plan}/${expiry} wins over parent Family`, () => {
  const dto = userDto({ ...child, plan, plan_expires_at: expiry });
  assert.equal(dto.effectivePlan, plan); assert.equal(dto.planSource, 'own'); assert.equal(dto.sourcePlanExpiresAt, expiry);
});
test('MOCKED_RUNTIME expired own plan keeps raw plan while falling back to Free', () => {
  const dto = userDto({ ...child, plan: 'premium', plan_expires_at: expired }, []);
  assert.equal(dto.effectivePlan, 'free'); assert.equal(dto.ownPlan, 'premium'); assert.equal(dto.sourcePlanExpiresAt, expired);
});
test('MOCKED_RUNTIME expired own plan can inherit trusted Family', () => {
  const dto = userDto({ ...child, plan: 'premium', plan_expires_at: expired });
  assert.equal(dto.effectivePlan, 'family'); assert.equal(dto.planSource, 'parent_family'); assert.equal(dto.sourcePlanExpiresAt, future);
});
for (const [label, overrides] of [
  ['untrusted integrity', { preapproval_integrity_version: 0 }], ['NULL integrity', { preapproval_integrity_version: null }],
  ['archived', { status: 'archived' }], ['pending', { status: 'pending_child_registration' }],
  ['no child', { child_user_id: null }], ['no parent', { parent_user_id: null }], ['self relation', { parent_user_id: uuid(2) }],
]) test(`MOCKED_RUNTIME ${label} cannot display parent or inherit Family`, () => {
  const dto = userDto(child, [relation(overrides)]); assert.equal(dto.effectivePlan, 'free'); assert.equal(dto.parent, null);
});
for (const status of ['linked', 'active']) test(`MOCKED_RUNTIME trusted ${status} displays and inherits parent`, () => {
  const dto = userDto(child, [relation({ status })]); assert.equal(dto.effectivePlan, 'family'); assert.equal(dto.parent.userId, uuid(1));
});
for (const [label, overrides] of [
  ['missing acknowledgement', { guardian_consent_acknowledged_at: null }], ['wrong consent version', { guardian_consent_version: 'wrong' }],
]) test(`MOCKED_RUNTIME ${label}: relation display remains distinct from entitlement`, () => {
  const dto = userDto(child, [relation(overrides)]); assert.equal(dto.effectivePlan, 'free'); assert.equal(dto.parent.userId, uuid(1));
});
for (const [label, parentMap] of [
  ['missing parent', new Map()], ['nonparent', new Map([[uuid(1), profile(1)]])],
]) test(`MOCKED_RUNTIME ${label} cannot display or inherit parent`, () => {
  const dto = userDto(child, [relation()], parentMap); assert.equal(dto.parent, null); assert.equal(dto.effectivePlan, 'free');
});
test('MOCKED_RUNTIME expired parent Family displays relation but no entitlement', () => {
  const dto = userDto(child, [relation()], new Map([[uuid(1), profile(1, { user_role: 'parent', plan: 'family', plan_expires_at: expired })]]));
  assert.ok(dto.parent); assert.equal(dto.effectivePlan, 'free');
});
test('MOCKED_RUNTIME unknown own plan falls back to Free', () => assert.equal(userDto({ ...child, plan: 'enterprise' }, []).effectivePlan, 'free'));
test('MOCKED_RUNTIME parent counts distinguish linked, pending, archived and untrusted', () => {
  const dto = userDto(parents.get(uuid(1)), [relation(), relation({ child_user_id: uuid(3), status: 'active' }),
    relation({ child_user_id: null, status: 'pending_child_registration' }), relation({ status: 'archived' }), relation({ preapproval_integrity_version: 0 })]);
  assert.equal(dto.linkedChildrenCount, 2); assert.equal(dto.pendingChildrenCount, 1);
});
test('MOCKED_RUNTIME pending count includes only integrity=1 preapprovals, excluding legacy/null/wrong versions', async () => {
  const pending = version => relation({ child_user_id: null, status: 'pending_child_registration', preapproval_integrity_version: version });
  const db = mockDatabase([parents.get(uuid(1))], [relation(), pending(1), pending(null), pending(0), pending(2), relation({ status: 'archived' })]);
  const result = await request({ action: 'list_users', typeFilter: 'parent' }, db);
  assert.equal(result.response.status, 200);
  assert.equal(result.data.users[0].pendingChildrenCount, 1);
  assert.equal(result.data.users[0].linkedChildrenCount, 1);
});
test('MOCKED_RUNTIME directory DTO is an explicit privacy allowlist', () => {
  const dto = userDto({ ...child, ocr: 'PRIVATE', usage_events: 'PRIVATE', user_metadata: 'PRIVATE' });
  assert.deepEqual(Object.keys(dto).sort(), ['userId', 'email', 'name', 'createdAt', 'businessType', 'rawUserRole', 'ageBand', 'accountStatus', 'ownPlan', 'effectivePlan', 'planSource', 'planExpiresAt', 'sourcePlanExpiresAt', 'parent', 'linkedChildrenCount', 'pendingChildrenCount', 'relationStatus'].sort());
  assert.deepEqual(Object.keys(dto.parent).sort(), ['email', 'name', 'userId']);
  assert.ok(!JSON.stringify(dto).includes('PRIVATE'));
});
test('MOCKED_RUNTIME server pagination, exact count, fixed order and global summary', async () => {
  const db = mockDatabase([profile(1, { user_role: 'parent' }), child, profile(3), profile(4, { user_role: null })], [relation()]);
  const result = await request({ action: 'list_users', page: 2, pageSize: 1, ownPlanFilter: 'free' }, db);
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.data.pagination, { page: 2, pageSize: 1, total: 4, totalPages: 4 });
  assert.deepEqual(result.data.summary, { totalProfiles: 4, parents: 1, childrenUnder13: 1, unknownRoleProfiles: 1 });
  assert.deepEqual(db.calls.queries[0].range, [1, 1]);
  assert.deepEqual(db.calls.queries[0].orders[0], ['created_at', { ascending: false }]);
  assert.equal(db.calls.queries[0].options.count, 'exact');
  assert.ok(db.calls.queries.slice(1, 5).every(query => query.options.head));
});
for (const [filter, expected] of [['parent', [1]], ['child_under_13', [2]], ['student', [3, 4]], ['unknown', [5, 6]]]) test(`MOCKED_RUNTIME ${filter} filter includes correct roles/NULL cases`, async () => {
  const db = mockDatabase([profile(1, { user_role: 'parent' }), child, profile(3), profile(4, { age_band: null }), profile(5, { user_role: null }), profile(6, { user_role: 'admin' })]);
  const result = await request({ action: 'list_users', typeFilter: filter }, db);
  assert.deepEqual(result.data.users.map(user => user.userId).sort(), expected.map(uuid).sort());
});
test('MOCKED_RUNTIME normal reads are constant batch queries with no per-user queries', async () => {
  const users = [parents.get(uuid(1)), child, ...Array.from({ length: 40 }, (_, i) => profile(i + 10))];
  const db = mockDatabase(users, [relation()]);
  await request({ action: 'list_users', pageSize: 50 }, db);
  assert.equal(db.calls.queries.length, 7);
  assert.equal(db.calls.queries.filter(query => query.table === 'child_profiles').length, 1);
  const relationFilter = db.calls.queries[5].filters[0][1];
  assert.match(relationFilter, /^parent_user_id\.in\.\([^)]*\),child_user_id\.in\.\([^)]*\)$/);
  for (const user of users) assert.equal(relationFilter.split(user.id).length - 1, 2);
  assert.deepEqual(db.calls.queries[6].filters, [['in', 'id', [uuid(1)]]]);
  assert.ok(db.calls.queries.every(query => query.columns !== '*'));
});
test('MOCKED_RUNTIME empty directory does not query relations or in([])', async () => {
  const result = await request({ action: 'list_users' }); assert.equal(result.calls.queries.length, 5); assert.deepEqual(result.data.users, []);
});
test('MOCKED_RUNTIME account issues separate unknown roles and orphan Auth; DTO excludes metadata', async () => {
  const db = mockDatabase([profile(1), profile(2, { user_role: null })], [], [
    { id: uuid(1), email: 'existing@example.invalid', created_at: '2026-01-01' },
    { id: uuid(3), email: 'orphan@example.invalid', created_at: '2026-02-01', last_sign_in_at: '2026-03-01', user_metadata: { secret: 'PRIVATE' }, app_metadata: { secret: 'PRIVATE' } },
  ]);
  const result = await request({ action: 'list_account_issues' }, db);
  assert.equal(result.response.status, 200); assert.equal(result.data.scanTruncated, false);
  assert.deepEqual(result.data.summary, { missingProfiles: 1, unknownRoleProfiles: 1, totalIssues: 2 });
  const missing = result.data.issues.find(issue => issue.issueType === 'missing_profile');
  assert.deepEqual(Object.keys(missing).sort(), ['issueType', 'userId', 'email', 'createdAt', 'lastSignInAt'].sort());
  assert.ok(!JSON.stringify(result.data).includes('PRIVATE'));
  assert.equal(result.data.issues.find(issue => issue.issueType === 'unknown_role').userId, uuid(2));
});
test('MOCKED_RUNTIME Auth scan caps at 1000 with truncation and five batched profile comparisons', async () => {
  const authUsers = Array.from({ length: 1100 }, (_, i) => ({ id: uuid(i + 1), email: 'test@example.invalid', created_at: '2026-01-01' }));
  const db = mockDatabase([], [], authUsers);
  const result = await request({ action: 'list_account_issues' }, db);
  assert.equal(result.data.scanTruncated, true); assert.equal(result.data.summary.missingProfiles, 1000);
  assert.equal(db.calls.authPages.length, 4); assert.equal(db.calls.queries.length, 6);
  assert.ok(db.calls.queries.slice(1).every(query => query.filters[0][2].length === 200));
});
test('MOCKED_RUNTIME unknown-role diagnostic cap also marks partial results', async () => {
  const db = mockDatabase(Array.from({ length: 1001 }, (_, i) => profile(i + 1, { user_role: null })));
  const result = await request({ action: 'list_account_issues' }, db);
  assert.equal(result.data.scanTruncated, true); assert.equal(result.data.issues.length, 1000);
  assert.equal(db.calls.queries.length, 1);
});
for (const action of ['list_users', 'list_account_issues']) for (const options of [{ queryError: true }, { throwQuery: true }]) test(`MOCKED_RUNTIME ${action} query failure is safe 503`, async () => {
  const result = await request({ action }, mockDatabase([], [], [], options));
  assert.equal(result.response.status, 503);
  assert.ok(!JSON.stringify(result.data).includes('private'));
  assert.deepEqual(result.boot.calls.logs, [['[admin-plan-management] Directory read failed']]);
});
test('MOCKED_RUNTIME Auth scan failure returns safe 503', async () => assert.equal((await request({ action: 'list_account_issues' }, mockDatabase([], [], [], { authScanError: true }))).response.status, 503));
test('STATIC_CONTRACT existing search/details/plan implementation remains unchanged apart from line endings', () => {
  const before = execFileSync('git', ['show', `HEAD:${edgePath}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
  const after = source.replace(/\r\n/g, '\n');
  const marker = '    // ── 6. Helpers';
  assert.equal(after.slice(after.indexOf(marker)), before.slice(before.indexOf(marker)));
  for (const action of ['search_user', 'get_user_details', 'activate_premium_30', 'activate_family_30', 'extend_premium_30', 'extend_family_30', 'set_free']) assert.ok(source.includes(`action === '${action}'`));
});
test('STATIC_CONTRACT AdminPage retains support, check_admin, selection and plan actions', () => {
  const before = execFileSync('git', ['show', `HEAD:${pagePath}`], { encoding: 'utf8' });
  const section = value => value.slice(value.indexOf('  // ── Initial Check'), value.indexOf('  // ── API call helper'));
  assert.equal(section(pageSource), section(before));
  assert.match(pageSource, /get_user_details/); assert.match(pageSource, /onSelectUser=\{handleSelectUser\}/);
  assert.match(pageSource, /Powrót do użytkowników/); assert.match(pageSource, /setAdminData\(null\)/);
  assert.doesNotMatch(pageSource, /Wyszukaj użytkownika|handleSearch|searchResults/);
  assert.doesNotMatch(uiSource, /support-inbox|admin_plan_actions|usage_events|parental_consents|set_free/);
});

// Exercise actual JSX/handlers with controlled hook doubles. This is not browser
// layout, React effect scheduling or live network integration coverage.
function renderDirectory({ directory = null, attention = null, mode = 'directory', loading = false, error = false } = {}) {
  let criteria = { search: '', typeFilter: 'all', ownPlanFilter: 'all', statusFilter: 'all', page: 2 };
  let selected;
  const values = ['', criteria, mode, directory, attention, loading, false, error, false, 0];
  let hook = 0;
  const js = ts.transpileModule(uiSource.replace(/^import .*;\r?\n/gm, '').replace('export default function', 'function'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText;
  const primitive = tag => ({ children, ...props }) => React.createElement(tag, props, children);
  const Component = new Function('React', 'useEffect', 'useState', 'Button', 'Input', 'Badge', 'Card', 'CardContent', 'Table', 'TableBody', 'TableCell', 'TableHead', 'TableHeader', 'TableRow', 'Loader2', 'Search', 'AlertTriangle', `${js}\nreturn AdminUserDirectory;`)(
    React, () => {}, () => { const index = hook++; return [values[index], value => {
      values[index] = typeof value === 'function' ? value(values[index]) : value;
      if (index === 1) criteria = values[index];
    }]; }, primitive('button'), primitive('input'), primitive('span'), primitive('article'), primitive('div'),
    primitive('table'), primitive('tbody'), primitive('td'), primitive('th'), primitive('thead'), primitive('tr'), primitive('svg'), primitive('svg'), primitive('svg'),
  );
  const tree = Component({ callAdminFunction: async () => ({}), onSelectUser: id => { selected = id; } });
  const elements = [];
  function visit(value) {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!React.isValidElement(value)) return;
    elements.push(value); visit(value.props.children);
  }
  visit(tree);
  return { html: renderToStaticMarkup(tree), elements, criteria: () => criteria, selected: () => selected };
}
const directoryFixture = { users: [userDto()], pagination: { page: 2, totalPages: 3 }, summary: { totalProfiles: 3, parents: 1, childrenUnder13: 1, unknownRoleProfiles: 1 } };
test('MOCKED_RUNTIME JSX renders seven-column desktop table and mobile cards with details', () => {
  const result = renderDirectory({ directory: directoryFixture });
  assert.equal((result.html.match(/<th\b/g) ?? []).length, 7);
  assert.match(result.html, /hidden md:block/); assert.match(result.html, /md:hidden/);
  assert.match(result.html, /Rodzic:/); assert.match(result.html, /od rodzica/);
  assert.match(result.html, /Szczegóły/); assert.ok(!result.html.includes(uuid(2)));
  assert.doesNotMatch(uiSource, /overflow-x-auto|swipe/i);
});
test('MOCKED_RUNTIME student relation is neutral in desktop and mobile, never assumed independent', () => {
  const student = userDto(profile(3, { age_band: '13_15' }), []);
  assert.equal(student.businessType, 'student');
  const result = renderDirectory({ directory: { ...directoryFixture, users: [student] } });
  const relations = result.elements.filter(element => typeof element.type === 'function' && element.type.name === 'Relation');
  assert.equal(relations.length, 2);
  for (const element of relations) assert.equal(renderToStaticMarkup(element), '<span>—</span>');
  assert.ok(!result.html.includes('Samodzielne'));
});
test('MOCKED_RUNTIME JSX handlers reset page for all filters and search', () => {
  const result = renderDirectory({ directory: directoryFixture });
  for (const element of result.elements.filter(element => element.type === 'select')) {
    element.props.onChange({ target: { value: 'all' } }); assert.equal(result.criteria().page, 1);
  }
  result.elements.find(element => element.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(result.criteria().page, 1);
});
test('MOCKED_RUNTIME JSX loading/error/empty messages are readable and do not expose DB errors', () => {
  assert.match(renderDirectory({ loading: true }).html, /Ładuję użytkowników/);
  assert.match(renderDirectory({ error: true }).html, /Spróbuj ponownie/);
  assert.match(renderDirectory().html, /Brak użytkowników spełniających kryteria/);
  assert.match(renderDirectory({ directory: { ...directoryFixture, users: [], summary: { totalProfiles: 0 } } }).html, /Brak profili użytkowników/);
});
test('MOCKED_RUNTIME JSX attention mode renders issues, incomplete warning and empty state', () => {
  assert.match(renderDirectory({ mode: 'attention', attention: { issues: [], summary: { missingProfiles: 0, unknownRoleProfiles: 0, totalIssues: 0 }, scanTruncated: false } }).html, /Brak kont wymagających uwagi/);
  const result = renderDirectory({ mode: 'attention', attention: { issues: [{ issueType: 'missing_profile', userId: uuid(7), email: 'test@example.invalid', createdAt: '2026-01-01' }], summary: { missingProfiles: 1, unknownRoleProfiles: 0, totalIssues: 1 }, scanTruncated: true } });
  assert.match(result.html, /Wynik może być niepełny/); assert.match(result.html, /Problemy danych/); assert.match(result.html, /Brak profilu/);
});
