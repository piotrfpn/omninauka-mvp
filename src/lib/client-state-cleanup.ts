export type ClientStateCleanupReason =
  | 'logout' | 'account_delete' | 'account_switch'
  | 'auth_invalidated' | 'startup_without_valid_session';

export const demoSessionKey = 'omninauka_demo_session';
const demoWindowNamePrefix = 'omninauka_demo_tab:';

// Only educational/account state belongs here. Theme, language, static PWA caches
// and Supabase persistence are deliberately left to their existing owners.
const userKeys = new Set([
  demoSessionKey,
  'currentSessionId', 'currentAnalysis', 'quizResults', 'demoImageBase64',
  'omninauka_upload_recovery', 'omninauka_upload_debug_events',
  'omninauka_mistake_review_context', 'omninauka_tutor_guidance_dismissed',
]);
const userPrefixes = [
  'flashcards-progress-', 'quiz-progress-', 'omninauka_flashcards_review_',
  'omninauka_free_flashcard_regen_used_', 'omninauka_mistake_review_done_',
];

export const clientStateOwnerKey = 'omninauka_client_state_owner';
let userId: string | null = null;
let ownerToken: string | null = null;
let demoTabToken: string | null = null;
let version = 0;
const objectUrls = new Set<string>();

function readOwner(): { userId: string; token: string } | null {
  try {
    const raw = window.localStorage.getItem(clientStateOwnerKey);
    const value = raw ? JSON.parse(raw) : null;
    return typeof value?.userId === 'string' && typeof value?.token === 'string' ? value : null;
  } catch {
    return null;
  }
}

function readDemoSession(): { userId: string; tabToken: string } | null {
  try {
    const raw = window.sessionStorage.getItem(demoSessionKey);
    const value = raw ? JSON.parse(raw) : null;
    return typeof value?.userId === 'string' && typeof value?.tabToken === 'string' && value.tabToken.length > 0
      ? { userId: value.userId, tabToken: value.tabToken }
      : null;
  } catch {
    return null;
  }
}

export function getClientStateVersion(): number {
  return version;
}

export function clearUserClientState(_reason: ClientStateCleanupReason, preserveSharedState = false): void {
  // Invalidate callbacks before touching storage, even if the browser denies removal.
  version++;
  userId = null;
  ownerToken = null;
  demoTabToken = null;
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();
  try {
    if (typeof window.name === 'string' && window.name.startsWith(demoWindowNamePrefix)) {
      window.name = '';
    }
  } catch { /* ignore */ }

  let failed = false;
  for (const type of ['localStorage', 'sessionStorage'] as const) {
    // Another tab already cleared/reassigned shared state. Only clear this tab's
    // private state; removing the new owner's localStorage would erase their work.
    if (preserveSharedState && type === 'localStorage') continue;
    try {
      const storage = window[type];
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
      for (const key of keys) {
        if (key && (key === clientStateOwnerKey || userKeys.has(key) || userPrefixes.some(prefix => key.startsWith(prefix)))) {
          try { storage.removeItem(key); } catch { failed = true; }
        }
      }
    } catch { failed = true; }
  }
  if (failed) throw new Error('Client state cleanup unavailable');
}

export function clearSessionClientState(userId: string, sessionId: string): void {
  const sessionSpecificKeys = [
    `flashcards-progress-${sessionId}`,
    `quiz-progress-${sessionId}`,
    `omninauka_flashcards_review_${userId}_${sessionId}`,
    `omninauka_free_flashcard_regen_used_${sessionId}`,
  ];

  for (const type of ['localStorage', 'sessionStorage'] as const) {
    try {
      const storage = window[type];
      for (const key of sessionSpecificKeys) {
        try { storage.removeItem(key); } catch { /* ignore */ }
      }

      // Also clear current session if it matches
      if (storage.getItem('currentSessionId') === sessionId) {
        try { storage.removeItem('currentSessionId'); } catch { /* ignore */ }
        try { storage.removeItem('currentAnalysis'); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }
}

export function activateUserClientState(nextUserId: string): number {
  clearDemoClientState();
  const owner = readOwner();
  // Unknown legacy ownership is cleaned once. A same-user reload/refresh keeps progress.
  if (owner?.userId !== nextUserId) clearUserClientState('account_switch');
  if (userId !== nextUserId || ownerToken !== owner?.token || demoTabToken !== null) version++;
  userId = nextUserId;
  demoTabToken = null;
  ownerToken = owner?.userId === nextUserId ? owner.token : crypto.randomUUID();
  window.localStorage.setItem(clientStateOwnerKey, JSON.stringify({ userId, token: ownerToken }));
  return version;
}

export function clearDemoClientState(): void {
  demoTabToken = null;
  try { window.sessionStorage.removeItem(demoSessionKey); } catch { /* ignore */ }
  try { window.localStorage.removeItem(demoSessionKey); } catch { /* ignore */ }
  try {
    if (typeof window.name === 'string' && window.name.startsWith(demoWindowNamePrefix)) {
      window.name = '';
    }
  } catch { /* ignore */ }
}

export function activateDemoClientState(demoUserId: string): number {
  // Demo sessions are strictly tab-local (sessionStorage + window.name) and do not
  // claim localStorage[clientStateOwnerKey]. If a previous real account owned
  // localStorage, or this tab is starting a fresh Demo session, clear prior state first.
  const existing = readDemoSession();
  const existingTabToken = existing?.userId === demoUserId ? existing.tabToken : null;
  const owner = readOwner();
  if (owner !== null || !existingTabToken) {
    clearUserClientState('account_switch');
  }

  const tabToken = existingTabToken ?? crypto.randomUUID();
  if (userId !== demoUserId || demoTabToken !== tabToken || ownerToken !== null) version++;
  userId = demoUserId;
  ownerToken = null;
  demoTabToken = tabToken;
  try {
    window.name = `${demoWindowNamePrefix}${tabToken}`;
  } catch { /* ignore */ }
  window.sessionStorage.setItem(demoSessionKey, JSON.stringify({ userId: demoUserId, tabToken }));
  return version;
}

export function getPersistedDemoTabToken(demoUserId: string): string | null {
  try {
    const parsed = readDemoSession();
    if (!parsed) return null;
    if (parsed.userId !== demoUserId) {
      clearDemoClientState();
      return null;
    }
    const expectedWindowName = `${demoWindowNamePrefix}${parsed.tabToken}`;
    const hasOpener = Boolean((window as Window & { opener?: unknown }).opener);
    const currentWindowName = typeof window.name === 'string' ? window.name : undefined;
    if (
      hasOpener ||
      (typeof currentWindowName === 'string' && currentWindowName.length > 0 && currentWindowName !== expectedWindowName)
    ) {
      clearDemoClientState();
      return null;
    }
    const owner = readOwner();
    if (owner && owner.userId !== demoUserId) {
      clearDemoClientState();
      return null;
    }
    return parsed.tabToken;
  } catch {
    clearDemoClientState();
    return null;
  }
}

export function hasPersistedDemoClientState(demoUserId: string): boolean {
  return getPersistedDemoTabToken(demoUserId) !== null;
}

// Capture once per mounted workspace/operation. The token also detects another
// tab changing accounts before its Auth event has reached this tab.
export function captureUserClientState(expectedUserId: string | undefined): () => boolean {
  const capturedVersion = version;
  const capturedToken = ownerToken;
  const capturedDemoToken = demoTabToken;
  return () => {
    if (!expectedUserId || userId !== expectedUserId || version !== capturedVersion) return false;
    if (capturedDemoToken) {
      const demo = readDemoSession();
      const owner = readOwner();
      return Boolean(
        demo?.userId === expectedUserId &&
        demo?.tabToken === capturedDemoToken &&
        (!owner || owner.userId === expectedUserId)
      );
    }
    return Boolean(capturedToken && readOwner()?.token === capturedToken);
  };
}

export function createUserObjectURL(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  objectUrls.add(url);
  return url;
}

export function revokeUserObjectURL(url: string): void {
  objectUrls.delete(url);
  URL.revokeObjectURL(url);
}
