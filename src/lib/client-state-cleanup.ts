export type ClientStateCleanupReason =
  | 'logout' | 'account_delete' | 'account_switch'
  | 'auth_invalidated' | 'startup_without_valid_session';

// Only educational/account state belongs here. Theme, language, static PWA caches
// and Supabase persistence are deliberately left to their existing owners.
const userKeys = new Set([
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

export function getClientStateVersion(): number {
  return version;
}

export function clearUserClientState(_reason: ClientStateCleanupReason, preserveSharedState = false): void {
  // Invalidate callbacks before touching storage, even if the browser denies removal.
  version++;
  userId = null;
  ownerToken = null;
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();

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

export function activateUserClientState(nextUserId: string): number {
  const owner = readOwner();
  // Unknown legacy ownership is cleaned once. A same-user reload/refresh keeps progress.
  if (owner?.userId !== nextUserId) clearUserClientState('account_switch');
  if (userId !== nextUserId || ownerToken !== owner?.token) version++;
  userId = nextUserId;
  ownerToken = owner?.userId === nextUserId ? owner.token : crypto.randomUUID();
  window.localStorage.setItem(clientStateOwnerKey, JSON.stringify({ userId, token: ownerToken }));
  return version;
}

// Capture once per mounted workspace/operation. The token also detects another
// tab changing accounts before its Auth event has reached this tab.
export function captureUserClientState(expectedUserId: string | undefined): () => boolean {
  const capturedVersion = version;
  const capturedToken = ownerToken;
  return () => Boolean(expectedUserId && userId === expectedUserId &&
    version === capturedVersion && capturedToken && readOwner()?.token === capturedToken);
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
