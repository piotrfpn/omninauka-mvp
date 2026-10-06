import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import ts from 'typescript';

const webhookContent = fs.readFileSync('supabase/functions/stripe-webhook/index.ts', 'utf8').replace(/\r\n/g, '\n');
const checkoutContent = fs.readFileSync('supabase/functions/create-checkout/index.ts', 'utf8').replace(/\r\n/g, '\n');
const migrationContent = fs.readFileSync('supabase/migrations/00080_stripe_payment_fulfillment.sql', 'utf8').replace(/\r\n/g, '\n');
const frontendContent = fs.readFileSync('src/pages/app/PaymentsPage.tsx', 'utf8').replace(/\r\n/g, '\n');

// 1. SYNTAX/PARSER TESTS (MANDATORY R6)
test('PAYMENTS_TSX_PARSE: PaymentsPage.tsx parses as valid TSX', () => {
  const sourceFile = ts.createSourceFile('PaymentsPage.tsx', frontendContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const diagnostics = sourceFile.parseDiagnostics;
  assert.equal(diagnostics.length, 0, 'Syntax errors found in PaymentsPage.tsx');
  // Regression check for single-line collapse
  const newlines = frontendContent.split('\n').length;
  assert.ok(newlines > 100, `File seems collapsed, only ${newlines} lines found`);
});

test('CREATE_CHECKOUT_TS_PARSE: create-checkout parses as valid TS', () => {
  const sourceFile = ts.createSourceFile('create-checkout.ts', checkoutContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const diagnostics = sourceFile.parseDiagnostics;
  assert.equal(diagnostics.length, 0, 'Syntax errors found in create-checkout');
  const newlines = checkoutContent.split('\n').length;
  assert.ok(newlines > 50, `File seems collapsed, only ${newlines} lines found`);
});

test('WEBHOOK_TS_PARSE: stripe-webhook parses as valid TS', () => {
  const sourceFile = ts.createSourceFile('stripe-webhook.ts', webhookContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const diagnostics = sourceFile.parseDiagnostics;
  assert.equal(diagnostics.length, 0, 'Syntax errors found in stripe-webhook');
  const newlines = webhookContent.split('\n').length;
  assert.ok(newlines > 50, `File seems collapsed, only ${newlines} lines found`);
});

// 2. STATIC_CONTRACT CREATE-CHECKOUT
test('STATIC_CONTRACT CREATE-CHECKOUT: POST only', () => {
  assert.ok(checkoutContent.includes('req.method !== "POST"'));
});
test('STATIC_CONTRACT CREATE-CHECKOUT: invalid/missing auth', () => {
  assert.ok(checkoutContent.includes('const authHeader = req.headers.get("Authorization");'));
  assert.ok(checkoutContent.includes('if (!authHeader)'));
  assert.ok(checkoutContent.includes('const { data: { user }, error: authError } = await supabaseClient.auth.getUser();'));
});
test('STATIC_CONTRACT CREATE-CHECKOUT: canonical auth user', () => {
  assert.ok(checkoutContent.includes('const userId = user.id;'));
});
test('STATIC_CONTRACT CREATE-CHECKOUT: strict empty body parsing', () => {
  assert.ok(checkoutContent.includes('Object.keys(value).length > 0'));
  assert.ok(checkoutContent.includes('Array.isArray(value)'));
});
test('STATIC_CONTRACT CREATE-CHECKOUT: account_status active accepted, NULL/pending/suspended denied', () => {
  assert.ok(checkoutContent.includes('if (profile.account_status !== "active")'));
});
test('STATIC_CONTRACT CREATE-CHECKOUT: active Family denied', () => {
  assert.ok(checkoutContent.includes('profile.plan === "family"'));
});
test('STATIC_CONTRACT CREATE-CHECKOUT: server Price only', () => {
  assert.ok(checkoutContent.includes('const priceId = Deno.env.get("STRIPE_PREMIUM_PRICE_ID");'));
  assert.ok(checkoutContent.includes('price: priceId'));
});
test('STATIC_CONTRACT CREATE-CHECKOUT: client_ref server user', () => {
  assert.ok(checkoutContent.includes('client_reference_id: userId'));
});
test('STATIC_CONTRACT CREATE-CHECKOUT: metadata user server user', () => {
  assert.ok(checkoutContent.includes('omninauka_user_id: userId'));
});
test('STATIC_CONTRACT CREATE-CHECKOUT: fixed APP_URL validation', () => {
  assert.ok(checkoutContent.includes('function isValidAppUrl(urlStr: string)'));
  assert.ok(checkoutContent.includes('url.protocol !== "https:"'));
  assert.ok(checkoutContent.includes('url.username || url.password || url.search || url.hash'));
});
test('STATIC_CONTRACT CREATE-CHECKOUT: no unsafe logs', () => {
  assert.ok(!checkoutContent.includes('console.error(stripeError.message)'));
  assert.ok(checkoutContent.includes('console.error("[create-checkout] stripe_session_create_failed");'));
});

// 3. STATIC_CONTRACT FRONTEND
test('STATIC_CONTRACT FRONTEND: exact checkout.stripe.com hostname, rejects attackerstripe.com and http', () => {
  assert.ok(frontendContent.includes('urlObj.protocol === \'https:\' && urlObj.hostname === \'checkout.stripe.com\''));
});
test('STATIC_CONTRACT FRONTEND: sync in-flight guard exists/works', () => {
  assert.ok(frontendContent.includes('const inFlightRef = useRef(false);'));
  assert.ok(frontendContent.includes('if (inFlightRef.current) return;'));
  assert.ok(frontendContent.includes('inFlightRef.current = true;'));
});
test('STATIC_CONTRACT FRONTEND: old Payment Link logic absent', () => {
  assert.ok(!frontendContent.includes('buildStripePaymentUrl'));
});

// 4. MOCKED_RUNTIME WEBHOOK
async function loadWebhookHandler(overrideStripe, overrideSupabase) {
  const body = webhookContent.replace(/^import .*;\r?\n/gm, '');
  const js = ts.transpileModule(body, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  let handler;
  const boot = new Function('serve', 'createClient', 'Stripe', 'Deno', 'console', js);

  boot(
    (fn) => { handler = fn; },
    overrideSupabase,
    overrideStripe,
    { env: { get: (k) => k === 'STRIPE_PREMIUM_PRICE_ID' ? 'price_premium' : 'test_val' } },
    { error: () => {} }
  );
  return handler;
}

test('MOCKED_RUNTIME WEBHOOK: invalid signature -> 400, no RPC', async () => {
  let rpcCalled = false;
  const stripeMock = function() { return { webhooks: { constructEventAsync: async () => { throw new Error('Bad sig'); } } }; };
  stripeMock.createFetchHttpClient = () => {};
  stripeMock.createSubtleCryptoProvider = () => {};
  const handler = await loadWebhookHandler(
    stripeMock,
    () => ({ rpc: async () => { rpcCalled = true; return { data: null }; } })
  );

  const req = new Request('https://example.com', { method: 'POST', body: 'body', headers: { 'Stripe-Signature': 'bad' } });
  const res = await handler(req);
  assert.equal(res.status, 400);
  assert.equal(rpcCalled, false);
});

test('MOCKED_RUNTIME WEBHOOK: missing signature -> 400, no RPC', async () => {
  let rpcCalled = false;
  const stripeMock = function() { return { webhooks: { constructEventAsync: async () => { throw new Error('Should not reach'); } } }; };
  stripeMock.createFetchHttpClient = () => {};
  stripeMock.createSubtleCryptoProvider = () => {};
  const handler = await loadWebhookHandler(stripeMock, () => ({ rpc: async () => { rpcCalled = true; return { data: null }; } }));
  const req = new Request('https://example.com', { method: 'POST', body: 'body', headers: {} });
  const res = await handler(req);
  assert.equal(res.status, 400);
  assert.equal(rpcCalled, false);
});

test('MOCKED_RUNTIME WEBHOOK: wrong Price ID -> NO RPC, safe 200', async () => {
  let rpcCalled = false;
  const stripeMock = function() {
    return {
      webhooks: { constructEventAsync: async () => ({
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: { object: {
          id: 'cs_123', payment_status: 'paid', mode: 'payment', payment_link: null,
          metadata: { omninauka_binding_version: 'checkout_v1', omninauka_plan: 'premium', omninauka_user_id: '11111111-1111-4111-8111-111111111111' },
          client_reference_id: '11111111-1111-4111-8111-111111111111',
        } }
      }) },
      checkout: { sessions: { listLineItems: async () => ({ data: [{ quantity: 1, price: { id: 'price_WRONG' } }], has_more: false }) } }
    };
  };
  stripeMock.createFetchHttpClient = () => {};
  stripeMock.createSubtleCryptoProvider = () => {};
  const handler = await loadWebhookHandler(stripeMock, () => ({ rpc: async () => { rpcCalled = true; return { data: null }; } }));
  const req = new Request('https://example.com', { method: 'POST', body: 'body', headers: { 'Stripe-Signature': 'good' } });
  const res = await handler(req);
  assert.equal(res.status, 200);
  assert.equal(rpcCalled, false);
});

test('MOCKED_RUNTIME WEBHOOK: legacy Payment Link + paid -> no RPC', async () => {
  let rpcCalled = false;
  const stripeMock = function() {
    return {
      webhooks: { constructEventAsync: async () => ({ type: 'checkout.session.completed', data: { object: { payment_status: 'paid', mode: 'payment', payment_link: 'plink_123' } } }) }
    };
  };
  stripeMock.createFetchHttpClient = () => {};
  stripeMock.createSubtleCryptoProvider = () => {};

  const handler = await loadWebhookHandler(stripeMock, () => ({ rpc: async () => { rpcCalled = true; return { data: null }; } }));
  const req = new Request('https://example.com', { method: 'POST', body: 'body', headers: { 'Stripe-Signature': 'good' } });
  const res = await handler(req);
  assert.equal(res.status, 200);
  assert.equal(rpcCalled, false);
});

test('MOCKED_RUNTIME WEBHOOK: completed + unpaid -> no RPC', async () => {
  let rpcCalled = false;
  const stripeMock = function() {
    return {
      webhooks: { constructEventAsync: async () => ({ type: 'checkout.session.completed', data: { object: { payment_status: 'unpaid', mode: 'payment', payment_link: null } } }) }
    };
  };
  stripeMock.createFetchHttpClient = () => {};
  stripeMock.createSubtleCryptoProvider = () => {};

  const handler = await loadWebhookHandler(stripeMock, () => ({ rpc: async () => { rpcCalled = true; return { data: null }; } }));
  const req = new Request('https://example.com', { method: 'POST', body: 'body', headers: { 'Stripe-Signature': 'good' } });
  const res = await handler(req);
  assert.equal(res.status, 200);
  assert.equal(rpcCalled, false);
});

test('MOCKED_RUNTIME WEBHOOK: async_payment_succeeded + paid + valid binding + valid Price -> fulfillment RPC exactly once', async () => {
  let rpcCalls = 0;
  const stripeMock = function() {
    return {
      webhooks: { constructEventAsync: async () => ({
        id: 'evt_123',
        type: 'checkout.session.async_payment_succeeded',
        data: { object: {
          id: 'cs_123',
          payment_status: 'paid',
          mode: 'payment',
          payment_link: null,
          metadata: { omninauka_binding_version: 'checkout_v1', omninauka_plan: 'premium', omninauka_user_id: '11111111-1111-4111-8111-111111111111' },
          client_reference_id: '11111111-1111-4111-8111-111111111111',
          amount_total: 1000,
          currency: 'pln'
        } }
      }) },
      checkout: { sessions: { listLineItems: async () => ({ data: [{ quantity: 1, price: { id: 'price_premium' } }], has_more: false }) } }
    };
  };
  stripeMock.createFetchHttpClient = () => {};
  stripeMock.createSubtleCryptoProvider = () => {};

  const handler = await loadWebhookHandler(stripeMock, () => ({ rpc: async () => { rpcCalls++; return { data: { outcome: 'processed' }, error: null }; } }));
  const req = new Request('https://example.com', { method: 'POST', body: 'body', headers: { 'Stripe-Signature': 'good' } });
  const res = await handler(req);
  assert.equal(res.status, 200);
  assert.equal(rpcCalls, 1);
});

test('MOCKED_RUNTIME WEBHOOK: malformed RPC matrix -> HTTP 500', async () => {
  const stripeMock = function() {
    return {
      webhooks: { constructEventAsync: async () => ({
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: { object: {
          id: 'cs_123',
          payment_status: 'paid',
          mode: 'payment',
          payment_link: null,
          metadata: { omninauka_binding_version: 'checkout_v1', omninauka_plan: 'premium', omninauka_user_id: '11111111-1111-4111-8111-111111111111' },
          client_reference_id: '11111111-1111-4111-8111-111111111111',
        } }
      }) },
      checkout: { sessions: { listLineItems: async () => ({ data: [{ quantity: 1, price: { id: 'price_premium' } }], has_more: false }) } }
    };
  };
  stripeMock.createFetchHttpClient = () => {};
  stripeMock.createSubtleCryptoProvider = () => {};

  const matrix = [
    null,
    {},
    [],
    { outcome: 'unknown' },
    { success: true }
  ];

  for (const outcome of matrix) {
    const handler = await loadWebhookHandler(stripeMock, () => ({ rpc: async () => ({ data: outcome }) }));
    const req = new Request('https://example.com', { method: 'POST', body: 'body', headers: { 'Stripe-Signature': 'good' } });
    const res = await handler(req);
    assert.equal(res.status, 500, `Expected 500 for RPC outcome: ${JSON.stringify(outcome)}`);
  }
});

test('MOCKED_RUNTIME WEBHOOK: reconciliation_required RPC outcome -> HTTP 200', async () => {
  const stripeMock = function() {
    return {
      webhooks: { constructEventAsync: async () => ({
        id: 'evt_123', type: 'checkout.session.completed',
        data: { object: {
          id: 'cs_123', payment_status: 'paid', mode: 'payment', payment_link: null,
          metadata: { omninauka_binding_version: 'checkout_v1', omninauka_plan: 'premium', omninauka_user_id: '11111111-1111-4111-8111-111111111111' },
          client_reference_id: '11111111-1111-4111-8111-111111111111',
        } }
      }) },
      checkout: { sessions: { listLineItems: async () => ({ data: [{ quantity: 1, price: { id: 'price_premium' } }], has_more: false }) } }
    };
  };
  stripeMock.createFetchHttpClient = () => {};
  stripeMock.createSubtleCryptoProvider = () => {};
  const handler = await loadWebhookHandler(stripeMock, () => ({ rpc: async () => { return { data: { outcome: 'reconciliation_required' } }; } }));
  const req = new Request('https://example.com', { method: 'POST', body: 'body', headers: { 'Stripe-Signature': 'good' } });
  const res = await handler(req);
  assert.equal(res.status, 200);
});

test('MOCKED_RUNTIME WEBHOOK: recognized duplicate_checkout_session -> HTTP 200', async () => {
  const stripeMock = function() {
    return {
      webhooks: { constructEventAsync: async () => ({
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: { object: {
          id: 'cs_123',
          payment_status: 'paid',
          mode: 'payment',
          payment_link: null,
          metadata: { omninauka_binding_version: 'checkout_v1', omninauka_plan: 'premium', omninauka_user_id: '11111111-1111-4111-8111-111111111111' },
          client_reference_id: '11111111-1111-4111-8111-111111111111',
        } }
      }) },
      checkout: { sessions: { listLineItems: async () => ({ data: [{ quantity: 1, price: { id: 'price_premium' } }], has_more: false }) } }
    };
  };
  stripeMock.createFetchHttpClient = () => {};
  stripeMock.createSubtleCryptoProvider = () => {};

  const handler = await loadWebhookHandler(stripeMock, () => ({ rpc: async () => { return { data: { outcome: 'duplicate_checkout_session' } }; } }));
  const req = new Request('https://example.com', { method: 'POST', body: 'body', headers: { 'Stripe-Signature': 'good' } });
  const res = await handler(req);
  assert.equal(res.status, 200);
});

// 5. STATIC_CONTRACT MIGRATION
test('STATIC_CONTRACT MIGRATION: UNIQUE partial stripe_session_id index exists', () => {
  assert.ok(migrationContent.includes('CREATE UNIQUE INDEX IF NOT EXISTS payment_events_stripe_session_id_unique'));
  assert.ok(migrationContent.includes('WHERE stripe_session_id IS NOT NULL'));
});
test('STATIC_CONTRACT MIGRATION: BEGIN/COMMIT present', () => {
  assert.ok(migrationContent.includes('BEGIN;'));
  assert.ok(migrationContent.includes('COMMIT;'));
});
test('STATIC_CONTRACT MIGRATION: ON CONFLICT DO NOTHING without narrow target', () => {
  assert.ok(migrationContent.includes('ON CONFLICT DO NOTHING'));
  assert.ok(!migrationContent.includes('ON CONFLICT (stripe_event_id) DO NOTHING'));
});
test('STATIC_CONTRACT MIGRATION: profile FOR UPDATE', () => {
  const lockIdx = migrationContent.indexOf('FOR UPDATE');
  const insertIdx = migrationContent.indexOf('event_type,\n      status,');
  assert.ok(lockIdx >= 0 && insertIdx >= 0 && lockIdx < insertIdx);
});
test('STATIC_CONTRACT MIGRATION: payload NULL everywhere', () => {
  const statements = migrationContent.split('INSERT INTO public.payment_events');
  assert.ok(statements.length > 1, 'Should find INSERTs');
  for (let i = 1; i < statements.length; i++) {
    const columnsPart = statements[i].split('VALUES')[0];
    const valuesPart = statements[i].split('VALUES')[1].split('ON CONFLICT')[0];

    const columnsMatch = columnsPart.match(/\(([^)]+)\)/);
    assert.ok(columnsMatch, 'Could not find column list in INSERT');
    const columns = columnsMatch[1].split(',').map(c => c.trim());
    const payloadIdx = columns.indexOf('payload');
    assert.ok(payloadIdx >= 0, 'payload column must be explicitly inserted');

    const valuesMatch = valuesPart.match(/\(([^]+)\)/);
    assert.ok(valuesMatch, 'Could not find VALUES list in INSERT');
    const valuesStr = valuesMatch[1];
    const values = valuesStr.split(',').map(v => v.trim());
    assert.equal(values[payloadIdx], 'NULL', 'payload must be strictly NULL in all INSERTs');
  }
});
test('STATIC_CONTRACT MIGRATION: duplicate session -> no second event row', () => {
  assert.ok(migrationContent.includes('RETURN jsonb_build_object(\'outcome\', \'duplicate_checkout_session\');'));
  // And it doesn't insert before returning that early.
  const checkIdx = migrationContent.indexOf('IF EXISTS (SELECT 1 FROM public.payment_events WHERE stripe_session_id = p_stripe_session_id) THEN');
  const insertIdx = migrationContent.indexOf('INSERT INTO public.payment_events');
  assert.ok(checkIdx >= 0 && insertIdx >= 0 && checkIdx < insertIdx);
});
test('STATIC_CONTRACT MIGRATION: missing profile => reconciliation_required with user_id NULL', () => {
  assert.ok(migrationContent.includes('target_profile_missing_reconciliation_required'));
  assert.ok(migrationContent.includes('NULL,\n      p_event_type,'));
});
test('STATIC_CONTRACT MIGRATION: active Family => reconciliation_required', () => {
  assert.ok(migrationContent.includes('active_family_reconciliation_required'));
});
test('STATIC_CONTRACT MIGRATION: ACL service_role only, search_path pinned', () => {
  assert.ok(migrationContent.includes('SECURITY DEFINER'));
  assert.ok(migrationContent.includes('SET search_path = public'));
  assert.ok(migrationContent.includes('REVOKE EXECUTE ON FUNCTION public.fulfill_stripe_premium_payment'));
  assert.ok(migrationContent.includes('GRANT EXECUTE ON FUNCTION public.fulfill_stripe_premium_payment'));
});
