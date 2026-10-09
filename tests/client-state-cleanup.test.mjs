import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createClientStateFixture as tab, MemoryStorage } from './client-state-fixture.mjs';

const educationalKeys = [
  'currentSessionId', 'currentAnalysis', 'quizResults', 'demoImageBase64',
  'omninauka_upload_recovery', 'omninauka_upload_debug_events',
  'omninauka_mistake_review_context', 'omninauka_tutor_guidance_dismissed',
  'flashcards-progress-session-a', 'quiz-progress-session-a',
  'omninauka_flashcards_review_user-a_session-a',
  'omninauka_free_flashcard_regen_used_session-a', 'omninauka_mistake_review_done_review-a',
];

function seed(t) {
  for (const storage of [t.localStorage, t.sessionStorage]) {
    for (const key of educationalKeys) storage.setItem(key, 'USER_A_PRIVATE_CONTENT');
    storage.setItem('omninauka-theme', 'dark');
    storage.setItem('i18nextLng', 'pl');
    storage.setItem('omninauka_vite_preload_reloaded', '1');
    storage.setItem('unrelated-application-key', 'keep');
    storage.setItem('sb-fixture-auth-token', 'SDK_OWNED');
  }
}

function assertClean(t) {
  for (const storage of [t.localStorage, t.sessionStorage]) {
    for (const key of educationalKeys) assert.equal(storage.getItem(key), null, key);
    assert.equal(storage.getItem('omninauka-theme'), 'dark');
    assert.equal(storage.getItem('i18nextLng'), 'pl');
    assert.equal(storage.getItem('omninauka_vite_preload_reloaded'), '1');
    assert.equal(storage.getItem('unrelated-application-key'), 'keep');
    assert.equal(storage.getItem('sb-fixture-auth-token'), 'SDK_OWNED');
  }
}

for (const reason of ['logout', 'account_delete', 'account_switch', 'auth_invalidated', 'startup_without_valid_session']) {
  test(`all educational keys cleared in both stores: ${reason}`, () => {
    const t = tab(); seed(t);
    t.helper.clearUserClientState(reason);
    assertClean(t);
    t.helper.clearUserClientState(reason);
    assertClean(t);
  });
}

test('unattributed legacy state is cleared before first authenticated workspace', () => {
  const t = tab(); seed(t);
  t.helper.activateUserClientState('user-b');
  assertClean(t);
  assert.equal(t.helper.captureUserClientState('user-b')(), true);
});

test('A → B invalidates old callbacks and clears progress before B can read it', () => {
  const t = tab(); t.helper.activateUserClientState('user-a'); seed(t);
  const oldCallback = t.helper.captureUserClientState('user-a');
  t.helper.activateUserClientState('user-b');
  if (oldCallback()) t.sessionStorage.setItem('currentAnalysis', 'LATE_A_RESULT');
  assertClean(t);
  assert.equal(oldCallback(), false);
  assert.equal(t.helper.captureUserClientState('user-b')(), true);
});

test('same-user refresh and reload preserve educational state and callback scope', () => {
  const t = tab(); const version = t.helper.activateUserClientState('user-a'); seed(t);
  const callback = t.helper.captureUserClientState('user-a');
  assert.equal(t.helper.activateUserClientState('user-a'), version);
  assert.equal(callback(), true);
  assert.equal(t.sessionStorage.getItem('currentAnalysis'), 'USER_A_PRIVATE_CONTENT');
  const reload = tab(t.localStorage);
  reload.helper.activateUserClientState('user-a');
  assert.equal(reload.localStorage.getItem('quiz-progress-session-a'), 'USER_A_PRIVATE_CONTENT');
});

test('A logout → A login cannot revive callbacks from the earlier login', () => {
  const t = tab(); t.helper.activateUserClientState('user-a');
  const callback = t.helper.captureUserClientState('user-a');
  t.helper.clearUserClientState('logout');
  t.helper.activateUserClientState('user-a');
  assert.equal(callback(), false);
});

test('another tab changing ownership invalidates callbacks before its Auth event arrives', () => {
  const first = tab(); first.helper.activateUserClientState('user-a');
  const second = tab(first.localStorage); second.helper.activateUserClientState('user-a');
  const callback = second.helper.captureUserClientState('user-a');
  first.helper.activateUserClientState('user-b');
  assert.equal(callback(), false);
});

test('cross-tab fallback clears private session state without erasing the new owner\'s shared progress', () => {
  const first = tab(); first.helper.activateUserClientState('user-a');
  const second = tab(first.localStorage); second.helper.activateUserClientState('user-a');
  second.sessionStorage.setItem('currentAnalysis', 'A');
  first.helper.activateUserClientState('user-b');
  first.localStorage.setItem('quiz-progress-session-b', 'B');
  second.helper.clearUserClientState('auth_invalidated', true);
  assert.equal(second.sessionStorage.getItem('currentAnalysis'), null);
  assert.equal(first.localStorage.getItem('quiz-progress-session-b'), 'B');
  assert.equal(first.helper.captureUserClientState('user-b')(), true);
});

test('tracked user blob URLs are revoked exactly once on cleanup', () => {
  const t = tab(); t.helper.createUserObjectURL(new Blob(['private image']));
  t.helper.clearUserClientState('logout'); t.helper.clearUserClientState('logout');
  assert.deepEqual(t.revoked, ['blob:test-user-image']);
});

test('storage failure invalidates callbacks and still clears the other store', () => {
  const t = tab(); t.helper.activateUserClientState('user-a'); seed(t);
  const callback = t.helper.captureUserClientState('user-a');
  t.localStorage.removeItem = () => { throw new Error('storage denied'); };
  assert.throws(() => t.helper.clearUserClientState('logout'), /cleanup unavailable/);
  assert.equal(callback(), false);
  assert.equal(t.sessionStorage.getItem('currentAnalysis'), null);
});

// Actual installed Auth SDK, real BroadcastChannel, synthetic HTTP only.
// This establishes whether a second tab receives SIGNED_OUT; it does not contact Supabase.
test('SDK propagates successful sign-out, but a rejected sign-out sends no SIGNED_OUT', async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = { location: { href: 'http://example.invalid/' }, addEventListener() {}, removeEventListener() {} };
  globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  const { GoTrueClient } = await import('@supabase/auth-js');
  const storage = new MemoryStorage();
  const fixtureUser = { id: '11111111-1111-4111-8111-111111111111', email: 'qa@example.invalid', user_metadata: {}, created_at: '2030-01-01T00:00:00Z' };
  let rejectSignout = false;
  const fetch = async url => {
    if (String(url).includes('/logout')) return rejectSignout
      ? new Response(JSON.stringify({ message: 'fixture unavailable' }), { status: 500 })
      : new Response(null, { status: 204 });
    return new Response(JSON.stringify({ user: fixtureUser, token_type: 'bearer', access_token: 'fixture-access-token', refresh_token: 'fixture-refresh-token', expires_in: 3600 }), { status: 200 });
  };
  const options = { url: 'http://example.invalid/auth', storage, storageKey: `priv02-test-${webcrypto.randomUUID()}`, fetch, autoRefreshToken: false, detectSessionInUrl: false };
  const first = new GoTrueClient(options);
  const second = new GoTrueClient(options);
  const events = [];
  const sub = second.onAuthStateChange(event => events.push(event));
  const settle = () => new Promise(resolve => setTimeout(resolve, 30));
  try {
    await Promise.all([first.initialize(), second.initialize()]);
    await first.signInWithPassword({ email: fixtureUser.email, password: 'fixture-only' });
    await settle();
    events.length = 0;
    rejectSignout = true;
    assert.ok((await first.signOut()).error);
    await settle();
    assert.equal(events.includes('SIGNED_OUT'), false);
    rejectSignout = false;
    assert.equal((await first.signOut()).error, null);
    await settle();
    assert.equal(events.includes('SIGNED_OUT'), true);
  } finally {
    sub.data.subscription.unsubscribe();
    for (const client of [first, second]) { await client.stopAutoRefresh(); client.broadcastChannel?.close(); }
    globalThis.window = previousWindow; globalThis.document = previousDocument;
  }
});
