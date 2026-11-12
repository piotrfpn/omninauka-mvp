import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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

// ─── PF-03.3B: Demo Session Persistence, Account Isolation, Quiz Guard & Startup Stability ───

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const [authContextSource, loginPageSource, quizPageSource, mainSource, indexHtmlSource, consentGuardSource, plLocaleSource] = await Promise.all([
  read('src/lib/auth-context.tsx'),
  read('src/pages/LoginPage.tsx'),
  read('src/pages/app/QuizPage.tsx'),
  read('src/main.tsx'),
  read('index.html'),
  read('src/components/auth/ConsentGuard.tsx'),
  read('src/i18n/locales/pl/common.json'),
]);

const mockDemoUser = {
  id: 'user-001',
  email: 'student@omninauka.pl',
  name: 'Kacper',
  avatar: '/avatars/student.png',
  createdAt: new Date('2024-01-15'),
  plan: 'premium',
};

function createAuthProviderRuntime({
  fixture = tab(),
  initialSession = null,
  deferGetSession = false,
  rejectGetSession = null,
  autoFireInitialSession = true,
  initialSessionFirst = false,
  debugLogs = null,
} = {}) {
  const cleanSource = authContextSource
    .replace(/^import [\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '')
    .replace(/import\.meta\.env\.DEV/g, 'false')
    .replace(/^export type\b/gm, 'type')
    .replace('export function AuthProvider', 'function AuthProvider')
    .replace('export function useAuth', 'function useAuth');
  const compiled = ts.transpileModule(cleanSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React },
  }).outputText;

  let currentContextValue = null;
  let fragmentKeys = [];
  let childRenderCount = 0;
  const slots = [];
  const effects = [];
  const cleanups = [];
  let cursor = 0;

  const useState = initial => {
    const slot = cursor++;
    if (!Object.hasOwn(slots, slot)) {
      slots[slot] = typeof initial === 'function' ? initial() : initial;
    }
    return [
      slots[slot],
      updater => {
        slots[slot] = typeof updater === 'function' ? updater(slots[slot]) : updater;
      },
    ];
  };
  const useRef = initial => {
    const slot = cursor++;
    if (!Object.hasOwn(slots, slot)) slots[slot] = { current: initial };
    return slots[slot];
  };
  const useEffect = (effect, deps) => {
    const slot = cursor++;
    const prevDeps = slots[slot];
    const changed = !prevDeps || !deps || deps.some((v, i) => !Object.is(v, prevDeps[i]));
    slots[slot] = deps;
    if (changed) effects.push(effect);
  };

  let authChangeCallback = null;
  let resolveGetSession = null;
  let currentSession = initialSession;
  let signOutCalls = 0;
  let clearStartupCalls = 0;
  const cleanupReasons = [];

  const wrappedHelper = {
    ...fixture.helper,
    clearUserClientState(reason, preserveSharedState) {
      cleanupReasons.push(reason);
      if (reason === 'startup_without_valid_session') clearStartupCalls++;
      return fixture.helper.clearUserClientState(reason, preserveSharedState);
    },
  };

  const supabaseStub = {
    auth: {
      async getSession() {
        if (rejectGetSession) {
          throw rejectGetSession instanceof Error ? rejectGetSession : new Error(String(rejectGetSession));
        }
        if (deferGetSession) {
          return new Promise(resolve => {
            resolveGetSession = s => resolve({ data: { session: s } });
          });
        }
        return { data: { session: currentSession } };
      },
      onAuthStateChange(cb) {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async signInWithPassword({ email }) {
        const sbUser = {
          id: `real-${email}`,
          email,
          created_at: '2026-01-01T00:00:00Z',
          user_metadata: { name: email.split('@')[0], ageBand: '16_17', accountStatus: 'active' },
        };
        currentSession = { user: sbUser, access_token: 'real-token' };
        if (authChangeCallback) authChangeCallback('SIGNED_IN', currentSession);
        return { data: { session: currentSession, user: sbUser }, error: null };
      },
      async signUp() {
        return { data: { user: null, session: null }, error: null };
      },
      async signOut() {
        signOutCalls++;
        currentSession = null;
        if (authChangeCallback) authChangeCallback('SIGNED_OUT', null);
        return { error: null };
      },
      async getUser() {
        return { data: { user: currentSession?.user ?? null }, error: null };
      },
      async updateUser() {
        return { error: null };
      },
    },
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: currentSession?.user
                      ? {
                          id: currentSession.user.id,
                          email: currentSession.user.email,
                          name: currentSession.user.user_metadata?.name ?? 'User',
                          plan: 'free',
                          age_band: currentSession.user.user_metadata?.ageBand ?? '16_17',
                          account_status: currentSession.user.user_metadata?.accountStatus ?? 'active',
                          user_role: currentSession.user.user_metadata?.user_role ?? 'student',
                        }
                      : null,
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
    async rpc() {
      return { data: { effective_plan: 'free' }, error: null };
    },
  };

  const ProviderComponent = ({ value, children }) => {
    currentContextValue = value;
    return children;
  };
  const FragmentCapture = ({ children }) => children;
  const customReact = {
    createElement(type, props, ...children) {
      if (type === FragmentCapture) {
        fragmentKeys.push(props?.key ?? null);
      }
      if (typeof type === 'function') {
        return type({ ...(props ?? {}), children });
      }
      return React.createElement(type, props, ...children);
    },
  };

  const factory = new Function(
    'React', 'createContext', 'useContext', 'useState', 'useEffect', 'useRef', 'Fragment',
    'mockUser', 'supabase',
    'activateDemoClientState', 'activateUserClientState', 'captureUserClientState',
    'clearDemoClientState', 'clearUserClientState', 'clientStateOwnerKey',
    'getClientStateVersion', 'getPersistedDemoTabToken', 'getSharedClientStateOwnerId', 'hasPersistedDemoClientState',
    'window', 'URLSearchParams', 'console',
    `${compiled}\nreturn { AuthProvider };`,
  );

  const { AuthProvider } = factory(
    customReact,
    () => ({ Provider: ProviderComponent }),
    () => currentContextValue,
    useState,
    useEffect,
    useRef,
    FragmentCapture,
    mockDemoUser,
    supabaseStub,
    wrappedHelper.activateDemoClientState,
    wrappedHelper.activateUserClientState,
    wrappedHelper.captureUserClientState,
    wrappedHelper.clearDemoClientState,
    wrappedHelper.clearUserClientState,
    wrappedHelper.clientStateOwnerKey,
    wrappedHelper.getClientStateVersion,
    wrappedHelper.getPersistedDemoTabToken,
    wrappedHelper.getSharedClientStateOwnerId,
    wrappedHelper.hasPersistedDemoClientState,
    fixture.window,
    URLSearchParams,
    {
      log(...args) { debugLogs?.push(args); },
      warn() {},
      error() {},
    },
  );

  const render = () => {
    cursor = 0;
    AuthProvider({
      children: customReact.createElement(() => {
        childRenderCount++;
        return null;
      }, null),
    });
    return currentContextValue;
  };

  const flushEffects = async () => {
    while (effects.length > 0) {
      const effect = effects.shift();
      if (initialSessionFirst && autoFireInitialSession && !authChangeCallback) {
        const cleanup = effect();
        if (typeof cleanup === 'function') cleanups.push(cleanup);
        if (authChangeCallback) authChangeCallback('INITIAL_SESSION', currentSession);
        await new Promise(r => setImmediate(r));
      } else {
        const cleanup = effect();
        if (typeof cleanup === 'function') cleanups.push(cleanup);
        await new Promise(r => setImmediate(r));
        if (autoFireInitialSession && authChangeCallback) {
          const cb = authChangeCallback;
          autoFireInitialSession = false;
          cb('INITIAL_SESSION', currentSession);
          await new Promise(r => setImmediate(r));
        }
      }
    }
    render();
    return currentContextValue;
  };

  return {
    fixture,
    render,
    flushEffects,
    get ctx() {
      render();
      return currentContextValue;
    },
    get fragmentKeys() {
      return fragmentKeys;
    },
    get childRenderCount() {
      return childRenderCount;
    },
    get cleanupReasons() {
      return cleanupReasons;
    },
    get clearStartupCalls() {
      return clearStartupCalls;
    },
    get signOutCalls() {
      return signOutCalls;
    },
    emitAuthEvent(event, session) {
      currentSession = session;
      if (authChangeCallback) authChangeCallback(event, session);
      render();
    },
    resolvePendingGetSession(session) {
      if (resolveGetSession) resolveGetSession(session);
    },
    unmount() {
      while (cleanups.length > 0) {
        cleanups.pop()();
      }
    },
  };
}

test('PF-03.3B (1) Demo -> F5 -> Demo persists in same tab, while new independent tab and opener tab do not inherit Demo', async () => {
  const firstTab = tab();
  const runtime1 = createAuthProviderRuntime({ fixture: firstTab });
  runtime1.render();
  await runtime1.flushEffects();
  assert.equal(runtime1.ctx.isAuthenticated, false);
  assert.equal(runtime1.ctx.isDemoMode, false);

  // Start Demo session
  const demoRes = await runtime1.ctx.loginAsDemo();
  assert.deepEqual(demoRes, { success: true });
  assert.equal(runtime1.ctx.isDemoMode, true);
  assert.equal(runtime1.ctx.isAuthenticated, true);
  assert.equal(runtime1.ctx.user.id, 'user-001');
  firstTab.sessionStorage.setItem('currentSessionId', 'demo-session');
  firstTab.sessionStorage.setItem('quizResults', JSON.stringify({ totalQuestions: 3, correctAnswers: 2 }));
  assert.ok(firstTab.sessionStorage.getItem('omninauka_demo_session'));

  // Simulate F5 / hard refresh in the same tab (previous tab runtime unloads cleanly)
  runtime1.unmount();
  const reloadRuntime = createAuthProviderRuntime({ fixture: firstTab });
  reloadRuntime.render();
  await reloadRuntime.flushEffects();
  assert.equal(reloadRuntime.ctx.isDemoMode, true, 'Demo mode must survive F5 refresh');
  assert.equal(reloadRuntime.ctx.isAuthenticated, true);
  assert.equal(reloadRuntime.ctx.user.id, 'user-001');
  assert.equal(firstTab.sessionStorage.getItem('currentSessionId'), 'demo-session');
  assert.equal(firstTab.sessionStorage.getItem('quizResults'), JSON.stringify({ totalQuestions: 3, correctAnswers: 2 }));

  // Simulate new independent tab (shares localStorage, empty sessionStorage)
  const independentTab = tab(firstTab.localStorage);
  const independentRuntime = createAuthProviderRuntime({ fixture: independentTab });
  independentRuntime.render();
  await independentRuntime.flushEffects();
  assert.equal(independentRuntime.ctx.isDemoMode, false, 'New independent tab must not inherit Demo mode');
  assert.equal(independentRuntime.ctx.isAuthenticated, false);

  // Simulate child tab opened with window.opener (browser clones sessionStorage, window.opener is set, window.name is empty)
  const openerTab = tab(firstTab.localStorage);
  for (const [k, v] of firstTab.sessionStorage.values.entries()) {
    openerTab.sessionStorage.setItem(k, v);
  }
  openerTab.window.opener = firstTab.window;
  openerTab.window.name = '';
  const openerRuntime = createAuthProviderRuntime({ fixture: openerTab });
  openerRuntime.render();
  await openerRuntime.flushEffects();
  assert.equal(openerRuntime.ctx.isDemoMode, false, 'Child tab opened with opener must not inherit Demo mode');
  assert.equal(openerRuntime.ctx.isAuthenticated, false);
  assert.equal(openerTab.sessionStorage.getItem('omninauka_demo_session'), null);
});

test('PF-03.3B (2) Demo -> logout -> Login clears Demo flag and all educational state', async () => {
  const t = tab();
  const runtime = createAuthProviderRuntime({ fixture: t });
  runtime.render();
  await runtime.flushEffects();

  await runtime.ctx.loginAsDemo();
  t.sessionStorage.setItem('currentSessionId', 'demo-session');
  t.sessionStorage.setItem('currentAnalysis', 'DEMO_ANALYSIS');
  t.localStorage.setItem('quiz-progress-demo-session', 'DEMO_PROGRESS');
  assert.equal(runtime.ctx.isDemoMode, true);

  await runtime.ctx.logout();
  assert.equal(runtime.ctx.isDemoMode, false);
  assert.equal(runtime.ctx.isAuthenticated, false);
  assert.equal(runtime.ctx.user, null);
  assert.equal(runtime.signOutCalls, 0, 'Demo logout should not call Supabase signOut when no real session exists');
  assert.equal(t.sessionStorage.getItem('omninauka_demo_session'), null);
  assert.equal(t.sessionStorage.getItem('currentSessionId'), null);
  assert.equal(t.sessionStorage.getItem('currentAnalysis'), null);
  assert.equal(t.localStorage.getItem('quiz-progress-demo-session'), null);

  // Subsequent F5 after Demo logout stays logged out
  const reloadAfterLogout = createAuthProviderRuntime({ fixture: t });
  reloadAfterLogout.render();
  await reloadAfterLogout.flushEffects();
  assert.equal(reloadAfterLogout.ctx.isDemoMode, false);
  assert.equal(reloadAfterLogout.ctx.isAuthenticated, false);
});

test('PF-03.3B (3) Demo -> real account isolates state, clears Demo flag, and real Supabase session takes priority', async () => {
  const t = tab();
  const runtime = createAuthProviderRuntime({ fixture: t });
  runtime.render();
  await runtime.flushEffects();

  await runtime.ctx.loginAsDemo();
  t.sessionStorage.setItem('currentAnalysis', 'DEMO_ONLY_DATA');
  const demoScope = t.helper.captureUserClientState('user-001');
  assert.equal(demoScope(), true);

  const ok = await runtime.ctx.login('uczen@szkola.pl', 'secret123');
  await new Promise(r => setImmediate(r));
  assert.equal(ok, true);
  assert.equal(runtime.ctx.isDemoMode, false);
  assert.equal(runtime.ctx.isAuthenticated, true);
  assert.equal(runtime.ctx.user.id, 'real-uczen@szkola.pl');
  assert.equal(t.sessionStorage.getItem('omninauka_demo_session'), null);
  assert.equal(t.sessionStorage.getItem('currentAnalysis'), null, 'Demo educational state must be cleared on real login');
  assert.equal(demoScope(), false, 'Demo callback scope must be invalidated when real user logs in');

  // Even if a stale Demo flag exists on startup alongside a real verified Supabase session, real session wins
  const tabWithBoth = tab();
  tabWithBoth.helper.activateDemoClientState('user-001');
  const realSbUser = {
    id: 'verified-supabase-user',
    email: 'verified@szkola.pl',
    created_at: '2026-01-01T00:00:00Z',
    user_metadata: { name: 'Weronika', ageBand: '16_17', accountStatus: 'active' },
  };
  const priorityRuntime = createAuthProviderRuntime({
    fixture: tabWithBoth,
    initialSession: { user: realSbUser, access_token: 'valid-jwt' },
  });
  priorityRuntime.render();
  await priorityRuntime.flushEffects();
  assert.equal(priorityRuntime.ctx.isDemoMode, false, 'Real Supabase session must always take priority over Demo');
  assert.equal(priorityRuntime.ctx.isAuthenticated, true);
  assert.equal(priorityRuntime.ctx.user.id, 'verified-supabase-user');
  assert.equal(tabWithBoth.sessionStorage.getItem('omninauka_demo_session'), null);
});

test('PF-03.3B (4) Real account -> attempt to start Demo never replaces or logs out the real user', async () => {
  const t = tab();
  const realSbUser = {
    id: 'real-student-id',
    email: 'real@szkola.pl',
    created_at: '2026-01-01T00:00:00Z',
    user_metadata: { name: 'Piotr', ageBand: '16_17', accountStatus: 'active' },
  };
  const runtime = createAuthProviderRuntime({
    fixture: t,
    initialSession: { user: realSbUser, access_token: 'valid-jwt' },
  });
  runtime.render();
  await runtime.flushEffects();

  t.sessionStorage.setItem('currentAnalysis', 'REAL_STUDENT_NOTES');
  const realScope = t.helper.captureUserClientState('real-student-id');
  assert.equal(runtime.ctx.isAuthenticated, true);
  assert.equal(runtime.ctx.isDemoMode, false);
  assert.equal(runtime.ctx.user.id, 'real-student-id');

  // Attempt to activate Demo while real session is active
  const blockedResult = await runtime.ctx.loginAsDemo();
  assert.deepEqual(blockedResult, { success: false, reason: 'real_session_active' });
  assert.equal(runtime.ctx.isDemoMode, false, 'Demo must not activate over an active real Supabase session');
  assert.equal(runtime.ctx.isAuthenticated, true);
  assert.equal(runtime.ctx.user.id, 'real-student-id');
  assert.equal(runtime.signOutCalls, 0, 'Real user must not be logged out');
  assert.equal(t.sessionStorage.getItem('currentAnalysis'), 'REAL_STUDENT_NOTES');
  assert.equal(realScope(), true);

  // Verify LoginPage handleDemoLogin redirects to the real user's dashboard without calling loginAsDemo
  const handleDemoMatch = loginPageSource.match(/const handleDemoLogin = (?:async )?\(\) => \{[\s\S]*?\n  \};/);
  assert.ok(handleDemoMatch, 'Expected handleDemoLogin in LoginPage.tsx');
  const handleDemoJs = ts.transpileModule(handleDemoMatch[0], {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  let demoCalls = 0;
  const navigations = [];
  const errors = [];
  const runHandleDemo = new Function(
    'isAuthenticated', 'isDemoMode', 'user', 'loginAsDemo', 'navigate', 'setError', 'setIsLoading', 't',
    `${handleDemoJs}\nreturn handleDemoLogin;`,
  )(
    true,
    false,
    { id: 'real-student-id', userRole: 'student' },
    async () => { demoCalls++; return { success: true }; },
    (to, opts) => navigations.push({ to, opts }),
    msg => errors.push(msg),
    () => {},
    (_k, fallback) => fallback,
  );
  await runHandleDemo();
  assert.equal(demoCalls, 0);
  assert.deepEqual(navigations, [{ to: '/app/dashboard', opts: { replace: true } }]);
  assert.deepEqual(errors, []);
});

test('PF-03.3B (5) Switching real account A -> B clears all account A state and isolates account B', async () => {
  const t = tab();
  const userA = {
    id: 'user-account-a',
    email: 'a@szkola.pl',
    created_at: '2026-01-01T00:00:00Z',
    user_metadata: { name: 'User A', ageBand: '16_17', accountStatus: 'active' },
  };
  const userB = {
    id: 'user-account-b',
    email: 'b@szkola.pl',
    created_at: '2026-01-01T00:00:00Z',
    user_metadata: { name: 'User B', ageBand: '16_17', accountStatus: 'active' },
  };
  const runtime = createAuthProviderRuntime({
    fixture: t,
    initialSession: { user: userA, access_token: 'jwt-a' },
  });
  runtime.render();
  await runtime.flushEffects();
  assert.equal(runtime.ctx.user.id, 'user-account-a');

  seed(t);
  const scopeA = t.helper.captureUserClientState('user-account-a');
  const versionA = t.helper.getClientStateVersion();

  // Switch to account B
  runtime.emitAuthEvent('SIGNED_IN', { user: userB, access_token: 'jwt-b' });
  await new Promise(r => setImmediate(r));
  assert.equal(runtime.ctx.user.id, 'user-account-b');
  assert.equal(runtime.ctx.isDemoMode, false);
  assertClean(t);
  assert.equal(scopeA(), false);
  assert.equal(t.helper.captureUserClientState('user-account-b')(), true);
  assert.ok(t.helper.getClientStateVersion() > versionA);
});

function createQuizCompletionRunner({ isDemoMode, user, routeId, currentSessionId }) {
  const start = quizPageSource.indexOf('  const handleNext = async () => {');
  const end = quizPageSource.indexOf('  if (isRegenerating) {', start);
  assert.ok(start >= 0 && end > start, 'Expected handleNext in QuizPage.tsx');
  const handleNextSource = quizPageSource.slice(start, end);
  const js = ts.transpileModule(handleNextSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;

  const sessionStore = new MemoryStorage();
  if (currentSessionId) sessionStore.setItem('currentSessionId', currentSessionId);

  const dbUpdates = [];
  let finishedState = false;
  const questions = [
    { id: 'q1', question: 'Q1' },
    { id: 'q2', question: 'Q2' },
  ];
  const answers = [{ questionId: 'q1', selectedAnswer: 0, isCorrect: true }];
  const lastAnswerRef = { current: { questionId: 'q2', selectedAnswer: 1, isCorrect: true } };

  const supabaseStub = {
    from(table) {
      assert.equal(table, 'study_sessions');
      return {
        update(payload) {
          return {
            async eq(col, val) {
              dbUpdates.push({ table, payload, col, val });
              return { error: null };
            },
          };
        },
      };
    },
  };

  const fn = new Function(
    'isCurrentUser', 'currentIndex', 'questions', 'setCurrentIndex', 'setSelectedOption', 'setShowFeedback',
    'setIsFinished', 'lastAnswerRef', 'answers', 'sessionStorage', 'routeId', 'user',
    'isDemoMode', 'supabase', 'console',
    `${js}\nreturn handleNext;`,
  )(
    () => true,
    questions.length - 1, // on the final question
    questions,
    () => {},
    () => {},
    () => {},
    val => { finishedState = val; },
    lastAnswerRef,
    answers,
    sessionStore,
    routeId,
    user,
    isDemoMode,
    supabaseStub,
    { log() {}, error() {} },
  );

  return { run: fn, dbUpdates, sessionStore, get isFinished() { return finishedState; } };
}

test('PF-03.3B (6) Demo Quiz completion calculates results in sessionStorage and performs zero Supabase writes', async () => {
  for (const [label, opts] of [
    ['demo-session with isDemoMode=true', { isDemoMode: true, user: mockDemoUser, routeId: undefined, currentSessionId: 'demo-session' }],
    ['mock session-001 with isDemoMode=true', { isDemoMode: true, user: mockDemoUser, routeId: 'session-001', currentSessionId: 'session-001' }],
    ['demo-session even if isDemoMode=false', { isDemoMode: false, user: mockDemoUser, routeId: 'demo-session', currentSessionId: 'demo-session' }],
  ]) {
    const quiz = createQuizCompletionRunner(opts);
    await quiz.run();
    assert.equal(quiz.isFinished, true, label);
    assert.equal(quiz.dbUpdates.length, 0, `Expected zero DB writes for ${label}`);
    const saved = JSON.parse(quiz.sessionStore.getItem('quizResults'));
    assert.equal(saved.totalQuestions, 2);
    assert.equal(saved.correctAnswers, 2);
    assert.equal(saved.answers.length, 2);
  }
});

test('PF-03.3B (7) Regular Quiz completion writes quiz_result to Supabase study_sessions', async () => {
  const realSessionId = '22222222-2222-4222-8222-222222222222';
  const quiz = createQuizCompletionRunner({
    isDemoMode: false,
    user: { id: 'real-user-1' },
    routeId: realSessionId,
    currentSessionId: realSessionId,
  });
  await quiz.run();
  assert.equal(quiz.isFinished, true);
  assert.equal(quiz.dbUpdates.length, 1);
  assert.equal(quiz.dbUpdates[0].table, 'study_sessions');
  assert.equal(quiz.dbUpdates[0].col, 'id');
  assert.equal(quiz.dbUpdates[0].val, realSessionId);
  assert.equal(quiz.dbUpdates[0].payload.quiz_result.score, 2);
  assert.equal(quiz.dbUpdates[0].payload.quiz_result.total, 2);
  assert.equal(quiz.dbUpdates[0].payload.quiz_result.percentage, 100);
  assert.equal(typeof quiz.dbUpdates[0].payload.quiz_result.completed_at, 'string');
});

test('PF-03.3B (8) Startup without session runs startup_without_valid_session cleanup only once and does not remount LoginPage', async () => {
  // Order A: getSession() resolves first, then INITIAL_SESSION event fires
  const runtimeA = createAuthProviderRuntime({ fixture: tab(), initialSession: null });
  runtimeA.render();
  const initialKeyA = runtimeA.fragmentKeys.at(-1);
  await runtimeA.flushEffects();
  assert.equal(runtimeA.clearStartupCalls, 1, 'startup_without_valid_session must run exactly once (getSession first)');
  assert.deepEqual(runtimeA.cleanupReasons, ['startup_without_valid_session']);
  assert.equal(runtimeA.fragmentKeys.at(-1), initialKeyA, 'Fragment key must not change on initial unauthenticated startup');

  // Order B: INITIAL_SESSION fires before getSession() resolves
  const runtimeB = createAuthProviderRuntime({
    fixture: tab(),
    initialSession: null,
    deferGetSession: true,
    initialSessionFirst: true,
  });
  runtimeB.render();
  const initialKeyB = runtimeB.fragmentKeys.at(-1);
  await runtimeB.flushEffects();
  runtimeB.resolvePendingGetSession(null);
  await new Promise(r => setImmediate(r));
  assert.equal(runtimeB.clearStartupCalls, 1, 'startup_without_valid_session must run exactly once (INITIAL_SESSION first)');
  assert.deepEqual(runtimeB.cleanupReasons, ['startup_without_valid_session']);
  assert.equal(runtimeB.fragmentKeys.at(-1), initialKeyB, 'Fragment key must not change on initial unauthenticated startup');
});

test('PF-03.3B (9) Light Mode and Dark Mode initialize synchronously in index.html <head> and src/main.tsx without flash', () => {
  // Verify index.html places the synchronous theme script in <head> before <body>
  const headEnd = indexHtmlSource.indexOf('</head>');
  const bodyStart = indexHtmlSource.indexOf('<body>');
  const inlineScriptMatch = indexHtmlSource.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(inlineScriptMatch && inlineScriptMatch.index < headEnd && headEnd < bodyStart, 'Inline theme script must execute in <head> before <body>');

  // Extract initializeThemeClass from src/main.tsx
  const fnMatch = mainSource.match(/export function initializeThemeClass[\s\S]*?\n\}/);
  assert.ok(fnMatch, 'Expected initializeThemeClass in src/main.tsx');
  const fnJs = ts.transpileModule(fnMatch[0].replace(/^export\s+/, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const initializeThemeClass = new Function(`${fnJs}\nreturn initializeThemeClass;`)();

  for (const [savedTheme, prefersDark, expectedDark] of [
    ['dark', false, true],
    ['dark', true, true],
    ['light', true, false],
    ['light', false, false],
    [null, true, true],
    [null, false, false],
  ]) {
    const classes = new Set();
    const doc = {
      documentElement: {
        classList: {
          add: c => classes.add(c),
          remove: c => classes.delete(c),
          toggle: (c, force) => (force ? classes.add(c) : classes.delete(c)),
          contains: c => classes.has(c),
        },
      },
    };
    const storage = { getItem: k => (k === 'omninauka-theme' ? savedTheme : null) };
    const win = { matchMedia: () => ({ matches: prefersDark }) };

    // 1. Run index.html <head> inline script
    new Function('localStorage', 'window', 'document', inlineScriptMatch[1])(storage, win, doc);
    assert.equal(doc.documentElement.classList.contains('dark'), expectedDark, `index.html <head> script for saved=${savedTheme}, prefersDark=${prefersDark}`);

    // 2. Run src/main.tsx initializeThemeClass
    const result = initializeThemeClass(doc, storage, win.matchMedia);
    assert.equal(result, expectedDark ? 'dark' : 'light');
    assert.equal(doc.documentElement.classList.contains('dark'), expectedDark, `main.tsx initializeThemeClass for saved=${savedTheme}, prefersDark=${prefersDark}`);
  }

  // Verify LoginPage preserves its background class and layout
  assert.match(loginPageSource, /omninauka-login-bg/);
});

test('PF-03.3B (10) No regression of ConsentGuard for 13–15 years and Demo mode', () => {
  const guardAst = ts.createSourceFile('ConsentGuard.tsx', consentGuardSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const guardDecl = guardAst.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'ConsentGuard');
  assert.ok(guardDecl);
  const guardJs = ts.transpileModule(
    guardDecl.getText(guardAst).replace('export function', 'function').replace('import.meta.env.DEV', 'false'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React } },
  ).outputText;
  const translations = JSON.parse(plLocaleSource);
  const translate = key => key.split('.').reduce((val, part) => val?.[part], translations) ?? key;

  const renderGuard = authState => {
    const noop = () => null;
    const Guard = new Function(
      'React', 'useState', 'useRef', 'useEffect', 'useAuth', 'useTranslation',
      'supabase', 'window', 'ShieldAlert', 'Loader2', 'LogOut', 'Navigate',
      `${guardJs}\nreturn ConsentGuard;`,
    )(
      React,
      init => [init, () => {}],
      init => ({ current: init }),
      () => {},
      () => ({
        isAuthenticated: true,
        isLoading: false,
        isProfileLoading: false,
        isProfileMissing: false,
        isDemoMode: false,
        refreshUser: async () => ({ success: true }),
        logout: async () => {},
        ...authState,
      }),
      () => ({ t: translate }),
      { rpc: async () => ({ data: null }) },
      { location: { search: '', pathname: '/app/dashboard' } },
      noop, noop, noop,
      ({ to }) => React.createElement('a', { 'data-redirect': to }),
    );
    return renderToStaticMarkup(
      Guard({ requireApproval: true, children: React.createElement('div', null, 'GUARD_PASS_CONTENT') }),
    );
  };

  // 13-15 pending_parent_consent -> redirects to /pending-consent
  const pending1315 = renderGuard({
    user: { id: 'u1', ageBand: '13_15', accountStatus: 'pending_parent_consent', userRole: 'student' },
  });
  assert.match(pending1315, /data-redirect="\/pending-consent"/);
  assert.doesNotMatch(pending1315, /GUARD_PASS_CONTENT/);

  // 13-15 parent_approved -> allowed
  const approved1315 = renderGuard({
    user: { id: 'u1', ageBand: '13_15', accountStatus: 'parent_approved', userRole: 'student' },
  });
  assert.match(approved1315, /GUARD_PASS_CONTENT/);

  // 13-15 parent_withdrawn -> blocked
  const withdrawn1315 = renderGuard({
    user: { id: 'u1', ageBand: '13_15', accountStatus: 'parent_withdrawn', userRole: 'student' },
  });
  assert.doesNotMatch(withdrawn1315, /GUARD_PASS_CONTENT/);
  assert.match(withdrawn1315, /Dostęp zablokowany/);

  // Demo mode -> allowed
  const demoHtml = renderGuard({
    user: mockDemoUser,
    isDemoMode: true,
  });
  assert.match(demoHtml, /GUARD_PASS_CONTENT/);
});

test('PF-03.3B (11) Tab duplication does not inherit Demo from an active Demo tab while F5 restores Demo after tab unload', async () => {
  const channels = new Map();
  class MockBroadcastChannel {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
      this.closed = false;
      if (!channels.has(name)) channels.set(name, new Set());
      channels.get(name).add(this);
    }
    postMessage(data) {
      if (this.closed) return;
      const peers = channels.get(this.name) ?? [];
      for (const peer of peers) {
        if (peer !== this && !peer.closed && typeof peer.onmessage === 'function') {
          queueMicrotask(() => {
            if (!peer.closed) peer.onmessage({ data });
          });
        }
      }
    }
    close() {
      this.closed = true;
      channels.get(this.name)?.delete(this);
    }
  }

  const tab1 = tab();
  tab1.window.BroadcastChannel = MockBroadcastChannel;
  const runtime1 = createAuthProviderRuntime({ fixture: tab1 });
  runtime1.render();
  await runtime1.flushEffects();

  await runtime1.ctx.loginAsDemo();
  assert.equal(runtime1.ctx.isDemoMode, true);
  tab1.localStorage.setItem('quiz-progress-demo-session', 'DEMO_QUIZ_PROGRESS');
  const originalSessionRaw = tab1.sessionStorage.getItem('omninauka_demo_session');
  const originalWindowName = tab1.window.name;
  assert.ok(originalSessionRaw);
  assert.match(originalWindowName, /^omninauka_demo_tab:/);
  assert.equal(tab1.localStorage.getItem('omninauka_client_state_owner'), null, 'Demo mode must remain tab-local and not claim localStorage owner');
  assert.equal(tab1.helper.captureUserClientState('user-001')(), true);

  // Opening a new unauthenticated tab must not log out Tab 1 or erase Tab 1's Demo state
  const newUnauthTab = tab(tab1.localStorage);
  newUnauthTab.window.BroadcastChannel = MockBroadcastChannel;
  const newUnauthRuntime = createAuthProviderRuntime({ fixture: newUnauthTab });
  newUnauthRuntime.render();
  await newUnauthRuntime.flushEffects();
  assert.equal(newUnauthRuntime.ctx.isDemoMode, false);
  assert.equal(newUnauthRuntime.ctx.isAuthenticated, false);
  assert.equal(runtime1.ctx.isDemoMode, true, 'New unauthenticated tab must not log out active Demo tab');
  assert.equal(tab1.helper.captureUserClientState('user-001')(), true);
  assert.equal(tab1.localStorage.getItem('quiz-progress-demo-session'), 'DEMO_QUIZ_PROGRESS');

  // Duplicate Tab 1 into Tab 2: browser clones sessionStorage, window.name, and shares localStorage with opener = null
  const tab2 = tab(tab1.localStorage);
  tab2.window.BroadcastChannel = MockBroadcastChannel;
  tab2.window.opener = null;
  tab2.window.name = originalWindowName;
  for (const [k, v] of tab1.sessionStorage.values.entries()) {
    tab2.sessionStorage.setItem(k, v);
  }

  const runtime2 = createAuthProviderRuntime({ fixture: tab2 });
  runtime2.render();
  await runtime2.flushEffects();

  assert.equal(runtime2.ctx.isDemoMode, false, 'Duplicated tab must not inherit active Demo session');
  assert.equal(runtime2.ctx.isAuthenticated, false);
  assert.equal(tab2.sessionStorage.getItem('omninauka_demo_session'), null, 'Duplicated tab must clear cloned demo flag');
  assert.equal(tab2.window.name, '');

  // Original Tab 1 must remain untouched in Demo mode
  assert.equal(runtime1.ctx.isDemoMode, true);
  assert.equal(tab1.sessionStorage.getItem('omninauka_demo_session'), originalSessionRaw);
  assert.equal(tab1.helper.captureUserClientState('user-001')(), true);

  // Now simulate real F5 on Tab 1 (unmount active runtime first, wait past 50ms probe timeout)
  newUnauthRuntime.unmount();
  runtime2.unmount();
  runtime1.unmount();
  const reloadRuntime = createAuthProviderRuntime({ fixture: tab1 });
  reloadRuntime.render();
  await reloadRuntime.flushEffects();
  await new Promise(r => setTimeout(r, 70));
  assert.equal(reloadRuntime.ctx.isDemoMode, true, 'Same tab F5 reload without live peer must restore Demo');
  assert.equal(reloadRuntime.ctx.isAuthenticated, true);
  reloadRuntime.unmount();
});

test('PF-03.3B (12) authDebug tracks current user email inside [] effect and logout resets profileInitialized', async () => {
  const t = tab();
  t.window.location = { search: '?uploadDebug=1' };
  const debugLogs = [];
  const runtime = createAuthProviderRuntime({ fixture: t, debugLogs });
  runtime.render();
  await runtime.flushEffects();

  await runtime.ctx.login('bojki@tlen.pl', 'secret123');
  await new Promise(r => setImmediate(r));
  const initialFetchesAfterFirstLogin = debugLogs.filter(args => args[1] === 'Starting INITIAL profile fetch');
  assert.equal(initialFetchesAfterFirstLogin.length, 1, 'First login must trigger INITIAL profile fetch and authDebug must see active email');

  await runtime.ctx.logout();
  await runtime.ctx.login('bojki@tlen.pl', 'secret123');
  await new Promise(r => setImmediate(r));
  const initialFetchesAfterSecondLogin = debugLogs.filter(args => args[1] === 'Starting INITIAL profile fetch');
  assert.equal(initialFetchesAfterSecondLogin.length, 2, 'Logout followed by login without remount must reset profileInitialized');
  runtime.unmount();
});

function createCrossTabLocalStorage() {
  const storage = new MemoryStorage();
  const subscribers = new Set();
  const baseSetItem = storage.setItem.bind(storage);
  const baseRemoveItem = storage.removeItem.bind(storage);

  storage.subscribe = (sourceWindow, fn) => {
    const entry = { sourceWindow, fn };
    subscribers.add(entry);
    return () => subscribers.delete(entry);
  };
  storage.setItemWithActor = (actorWindow, key, value) => {
    baseSetItem(key, value);
    for (const sub of subscribers) {
      if (sub.sourceWindow !== actorWindow) {
        sub.fn({ storageArea: storage, key });
      }
    }
  };
  storage.removeItemWithActor = (actorWindow, key) => {
    baseRemoveItem(key);
    for (const sub of subscribers) {
      if (sub.sourceWindow !== actorWindow) {
        sub.fn({ storageArea: storage, key });
      }
    }
  };
  return storage;
}

function attachSharedStorage(t, sharedStorage) {
  const proxyStorage = {
    get length() { return sharedStorage.length; },
    key: index => sharedStorage.key(index),
    getItem: key => sharedStorage.getItem(key),
    setItem: (key, value) => sharedStorage.setItemWithActor(t.window, key, value),
    removeItem: key => sharedStorage.removeItemWithActor(t.window, key),
  };
  const origAdd = t.window.addEventListener;
  const origRemove = t.window.removeEventListener;
  let unsubscribeStorage = null;
  t.window.localStorage = proxyStorage;
  t.localStorage = proxyStorage;
  t.window.addEventListener = (name, handler) => {
    origAdd(name, handler);
    if (name === 'storage') {
      unsubscribeStorage?.();
      unsubscribeStorage = sharedStorage.subscribe(t.window, event => {
        handler({ ...event, storageArea: proxyStorage });
      });
    }
  };
  t.window.removeEventListener = name => {
    origRemove(name);
    if (name === 'storage') {
      unsubscribeStorage?.();
      unsubscribeStorage = null;
    }
  };
  return t;
}

test('PF-03.3B (13) Active real Supabase account in Tab A survives unauthenticated Tab B startup_without_valid_session', async () => {
  const sharedStorage = createCrossTabLocalStorage();
  const tabA = attachSharedStorage(tab(sharedStorage), sharedStorage);
  const userA = {
    id: 'real-student-a',
    email: 'a@szkola.pl',
    created_at: '2026-01-01T00:00:00Z',
    user_metadata: { name: 'Ala', ageBand: '16_17', accountStatus: 'active' },
  };

  const runtimeA = createAuthProviderRuntime({
    fixture: tabA,
    initialSession: { user: userA, access_token: 'jwt-a' },
  });
  runtimeA.render();
  await runtimeA.flushEffects();
  assert.equal(runtimeA.ctx.isAuthenticated, true);
  assert.equal(runtimeA.ctx.user.id, 'real-student-a');

  // Seed Tab A's real educational state in both shared localStorage and Tab A's private sessionStorage
  tabA.localStorage.setItem('quiz-progress-session-a', 'USER_A_QUIZ_PROGRESS');
  tabA.localStorage.setItem('flashcards-progress-session-a', 'USER_A_FLASHCARDS_PROGRESS');
  tabA.localStorage.setItem('omninauka_flashcards_review_real-student-a_session-a', 'USER_A_REVIEW');
  tabA.sessionStorage.setItem('currentSessionId', 'session-a');
  tabA.sessionStorage.setItem('currentAnalysis', 'USER_A_ANALYSIS');
  const ownerBefore = sharedStorage.getItem('omninauka_client_state_owner');
  assert.ok(ownerBefore);
  assert.equal(JSON.parse(ownerBefore).userId, 'real-student-a');
  const scopeA = tabA.helper.captureUserClientState('real-student-a');
  assert.equal(scopeA(), true);

  // Tab B opens in the same browser context without a valid Supabase session (with stale local sessionStorage)
  const tabB = attachSharedStorage(tab(sharedStorage), sharedStorage);
  tabB.sessionStorage.setItem('currentAnalysis', 'STALE_TAB_B_ANALYSIS');
  tabB.sessionStorage.setItem('omninauka_upload_recovery', 'STALE_TAB_B_RECOVERY');
  const runtimeB = createAuthProviderRuntime({
    fixture: tabB,
    initialSession: null,
  });
  runtimeB.render();
  await runtimeB.flushEffects();

  // Tab B must fail closed: signed out, private sessionStorage cleared, no access to Tab A's session
  assert.deepEqual(runtimeB.cleanupReasons, ['startup_without_valid_session']);
  assert.equal(runtimeB.ctx.isAuthenticated, false);
  assert.equal(runtimeB.ctx.user, null);
  assert.equal(runtimeB.ctx.isDemoMode, false);
  assert.equal(tabB.sessionStorage.getItem('currentAnalysis'), null);
  assert.equal(tabB.sessionStorage.getItem('omninauka_upload_recovery'), null);

  // Shared localStorage and Tab A's active session must remain completely intact
  assert.equal(sharedStorage.getItem('omninauka_client_state_owner'), ownerBefore);
  assert.equal(sharedStorage.getItem('quiz-progress-session-a'), 'USER_A_QUIZ_PROGRESS');
  assert.equal(sharedStorage.getItem('flashcards-progress-session-a'), 'USER_A_FLASHCARDS_PROGRESS');
  assert.equal(sharedStorage.getItem('omninauka_flashcards_review_real-student-a_session-a'), 'USER_A_REVIEW');

  assert.equal(runtimeA.ctx.isAuthenticated, true);
  assert.equal(runtimeA.ctx.user.id, 'real-student-a');
  assert.equal(tabA.sessionStorage.getItem('currentSessionId'), 'session-a');
  assert.equal(tabA.sessionStorage.getItem('currentAnalysis'), 'USER_A_ANALYSIS');
  assert.equal(scopeA(), true);

  runtimeB.unmount();
  runtimeA.unmount();
});

test('PF-03.3B (14) Transient getSession error in Tab B fails closed without disrupting Tab A, while explicit logout in Tab A still clears shared state', async () => {
  const sharedStorage = createCrossTabLocalStorage();
  const tabA = attachSharedStorage(tab(sharedStorage), sharedStorage);
  const userA = {
    id: 'real-student-a',
    email: 'a@szkola.pl',
    created_at: '2026-01-01T00:00:00Z',
    user_metadata: { name: 'Ala', ageBand: '16_17', accountStatus: 'active' },
  };

  const runtimeA = createAuthProviderRuntime({
    fixture: tabA,
    initialSession: { user: userA, access_token: 'jwt-a' },
  });
  runtimeA.render();
  await runtimeA.flushEffects();

  tabA.localStorage.setItem('quiz-progress-session-a', 'USER_A_QUIZ_PROGRESS');
  tabA.localStorage.setItem('flashcards-progress-session-a', 'USER_A_FLASHCARDS_PROGRESS');
  tabA.sessionStorage.setItem('currentAnalysis', 'USER_A_ANALYSIS');
  const ownerBefore = sharedStorage.getItem('omninauka_client_state_owner');
  const scopeA = tabA.helper.captureUserClientState('real-student-a');

  // Tab B encounters a transient getSession() failure
  const tabB = attachSharedStorage(tab(sharedStorage), sharedStorage);
  tabB.sessionStorage.setItem('currentAnalysis', 'STALE_TAB_B_DATA');
  const runtimeB = createAuthProviderRuntime({
    fixture: tabB,
    initialSession: null,
    rejectGetSession: new Error('Temporary network error'),
    autoFireInitialSession: false,
  });
  runtimeB.render();
  await runtimeB.flushEffects();

  assert.deepEqual(runtimeB.cleanupReasons, ['auth_invalidated']);
  assert.equal(runtimeB.ctx.isAuthenticated, false);
  assert.equal(runtimeB.ctx.user, null);
  assert.equal(tabB.sessionStorage.getItem('currentAnalysis'), null);

  // Tab A and shared localStorage must remain unaffected
  assert.equal(sharedStorage.getItem('omninauka_client_state_owner'), ownerBefore);
  assert.equal(sharedStorage.getItem('quiz-progress-session-a'), 'USER_A_QUIZ_PROGRESS');
  assert.equal(sharedStorage.getItem('flashcards-progress-session-a'), 'USER_A_FLASHCARDS_PROGRESS');
  assert.equal(runtimeA.ctx.isAuthenticated, true);
  assert.equal(runtimeA.ctx.user.id, 'real-student-a');
  assert.equal(scopeA(), true);

  // Explicit logout in Tab A MUST clear both localStorage and sessionStorage and call Supabase signOut
  await runtimeA.ctx.logout();
  assert.equal(runtimeA.signOutCalls, 1);
  assert.equal(runtimeA.ctx.isAuthenticated, false);
  assert.equal(runtimeA.ctx.user, null);
  assert.equal(sharedStorage.getItem('omninauka_client_state_owner'), null);
  assert.equal(sharedStorage.getItem('quiz-progress-session-a'), null);
  assert.equal(sharedStorage.getItem('flashcards-progress-session-a'), null);
  assert.equal(tabA.sessionStorage.getItem('currentAnalysis'), null);
  assert.equal(scopeA(), false);

  runtimeB.unmount();
  runtimeA.unmount();
});

test('PF-03.3B (15) Demo activation in Tab B is blocked fail-closed while real account in Tab A is active, and allowed after explicit logout', async () => {
  const sharedStorage = createCrossTabLocalStorage();
  const tabA = attachSharedStorage(tab(sharedStorage), sharedStorage);
  const userA = {
    id: 'real-student-a',
    email: 'a@szkola.pl',
    created_at: '2026-01-01T00:00:00Z',
    user_metadata: { name: 'Ala', ageBand: '16_17', accountStatus: 'active' },
  };

  const runtimeA = createAuthProviderRuntime({
    fixture: tabA,
    initialSession: { user: userA, access_token: 'jwt-a' },
  });
  runtimeA.render();
  await runtimeA.flushEffects();
  assert.equal(runtimeA.ctx.isAuthenticated, true);
  assert.equal(runtimeA.ctx.user.id, 'real-student-a');

  tabA.localStorage.setItem('quiz-progress-session-a', 'USER_A_QUIZ_PROGRESS');
  tabA.localStorage.setItem('flashcards-progress-session-a', 'USER_A_FLASHCARDS_PROGRESS');
  tabA.sessionStorage.setItem('currentAnalysis', 'USER_A_ANALYSIS');
  const ownerBefore = sharedStorage.getItem('omninauka_client_state_owner');
  const scopeA = tabA.helper.captureUserClientState('real-student-a');
  assert.ok(ownerBefore);
  assert.equal(scopeA(), true);

  // Case 1: Tab B has no Supabase session (null) and sees only shared localStorage owner -> blocked fail-closed
  const tabB = attachSharedStorage(tab(sharedStorage), sharedStorage);
  const runtimeB = createAuthProviderRuntime({
    fixture: tabB,
    initialSession: null,
  });
  runtimeB.render();
  await runtimeB.flushEffects();

  const conflictRes = await runtimeB.ctx.loginAsDemo();
  assert.deepEqual(conflictRes, { success: false, reason: 'shared_owner_conflict' });
  assert.equal(runtimeB.ctx.isDemoMode, false);
  assert.equal(runtimeB.ctx.isAuthenticated, false);
  assert.equal(runtimeB.ctx.user, null);
  assert.equal(tabB.sessionStorage.getItem('omninauka_demo_session'), null);
  assert.equal(runtimeB.signOutCalls, 0, 'Blocking Demo must never call Supabase signOut');

  // Direct helper bypass must also throw fail-closed without touching Tab A's owner or data
  assert.throws(() => tabB.helper.activateDemoClientState('user-001'), /Cannot activate Demo/);

  // Tab A and all its educational data remain completely untouched
  assert.equal(sharedStorage.getItem('omninauka_client_state_owner'), ownerBefore);
  assert.equal(sharedStorage.getItem('quiz-progress-session-a'), 'USER_A_QUIZ_PROGRESS');
  assert.equal(sharedStorage.getItem('flashcards-progress-session-a'), 'USER_A_FLASHCARDS_PROGRESS');
  assert.equal(tabA.sessionStorage.getItem('currentAnalysis'), 'USER_A_ANALYSIS');
  assert.equal(runtimeA.ctx.isAuthenticated, true);
  assert.equal(runtimeA.ctx.user.id, 'real-student-a');
  assert.equal(scopeA(), true);

  // Case 2: Tab B sees a verified Supabase session in getSession() -> blocked with real_session_active, no signOut
  const tabC = attachSharedStorage(tab(sharedStorage), sharedStorage);
  const runtimeC = createAuthProviderRuntime({
    fixture: tabC,
    initialSession: { user: userA, access_token: 'jwt-a' },
  });
  runtimeC.render();
  await runtimeC.flushEffects();
  const realSessionRes = await runtimeC.ctx.loginAsDemo();
  assert.deepEqual(realSessionRes, { success: false, reason: 'real_session_active' });
  assert.equal(runtimeC.ctx.isDemoMode, false);
  assert.equal(runtimeC.signOutCalls, 0);
  assert.equal(sharedStorage.getItem('omninauka_client_state_owner'), ownerBefore);
  assert.equal(sharedStorage.getItem('quiz-progress-session-a'), 'USER_A_QUIZ_PROGRESS');

  // Case 3: Tab B encounters getSession() error -> blocked fail-closed without clearing shared owner
  const tabD = attachSharedStorage(tab(sharedStorage), sharedStorage);
  const runtimeD = createAuthProviderRuntime({
    fixture: tabD,
    initialSession: null,
    rejectGetSession: new Error('Network error'),
    autoFireInitialSession: false,
  });
  runtimeD.render();
  await runtimeD.flushEffects();
  const errRes = await runtimeD.ctx.loginAsDemo();
  assert.deepEqual(errRes, { success: false, reason: 'auth_unavailable' });
  assert.equal(runtimeD.ctx.isDemoMode, false);
  assert.equal(sharedStorage.getItem('omninauka_client_state_owner'), ownerBefore);
  assert.equal(sharedStorage.getItem('quiz-progress-session-a'), 'USER_A_QUIZ_PROGRESS');

  // Case 4: After explicit safe logout in Tab A, Demo can be started safely
  await runtimeA.ctx.logout();
  assert.equal(sharedStorage.getItem('omninauka_client_state_owner'), null);
  assert.equal(sharedStorage.getItem('quiz-progress-session-a'), null);
  const okAfterLogout = await runtimeB.ctx.loginAsDemo();
  assert.deepEqual(okAfterLogout, { success: true });
  assert.equal(runtimeB.ctx.isDemoMode, true);
  assert.equal(runtimeB.ctx.isAuthenticated, true);
  assert.equal(runtimeB.ctx.user.id, 'user-001');

  runtimeD.unmount();
  runtimeC.unmount();
  runtimeB.unmount();
  runtimeA.unmount();
});

test('PF-03.3B (16) LoginPage handleDemoLogin blocks navigation and renders a clear user message when loginAsDemo denies activation', async () => {
  const handleDemoMatch = loginPageSource.match(/const handleDemoLogin = (?:async )?\(\) => \{[\s\S]*?\n  \};/);
  assert.ok(handleDemoMatch, 'Expected handleDemoLogin in LoginPage.tsx');
  const handleDemoJs = ts.transpileModule(handleDemoMatch[0], {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;

  for (const reason of ['real_session_active', 'shared_owner_conflict', 'auth_unavailable']) {
    const navigations = [];
    const errors = [];
    const loadingStates = [];
    const runHandleDemo = new Function(
      'isAuthenticated', 'isDemoMode', 'user', 'loginAsDemo', 'navigate', 'setError', 'setIsLoading', 't',
      `${handleDemoJs}\nreturn handleDemoLogin;`,
    )(
      false,
      false,
      null,
      async () => ({ success: false, reason }),
      (to, opts) => navigations.push({ to, opts }),
      msg => errors.push(msg),
      val => loadingStates.push(val),
      (_key, fallback) => fallback,
    );

    await runHandleDemo();
    assert.deepEqual(navigations, [], `Must never navigate to /app/dashboard when reason=${reason}`);
    assert.equal(errors.length >= 2 && errors[0] === '' && errors[1].length > 20, true, `Expected clear error message for ${reason}`);
    assert.deepEqual(loadingStates, [true, false]);
  }
});
