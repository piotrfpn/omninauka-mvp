export type AuthErrorKey = 'auth.errors.unconfirmed' | 'auth.login.error.invalid'
  | 'auth.errors.emailLimit' | 'auth.errors.requestLimit' | 'auth.errors.network'
  | 'auth.errors.generic';

export type LoginResult = { success: true } | { success: false; errorKey: AuthErrorKey };

/** Only documented codes determine account state; never inspect provider wording. */
export function authErrorKey(error: unknown): AuthErrorKey {
  const details = typeof error === 'object' && error !== null
    ? error as { code?: unknown; status?: unknown; name?: unknown } : {};
  switch (details.code) {
    case 'email_not_confirmed': return 'auth.errors.unconfirmed';
    case 'invalid_credentials': return 'auth.login.error.invalid';
    case 'over_email_send_rate_limit': return 'auth.errors.emailLimit';
    case 'over_request_rate_limit': return 'auth.errors.requestLimit';
    case 'request_timeout': return 'auth.errors.network';
  }
  if (details.status === 429) return 'auth.errors.requestLimit';
  if (details.status === 0 || details.name === 'AuthRetryableFetchError'
    || error instanceof TypeError) return 'auth.errors.network';
  return 'auth.errors.generic';
}

/** Recovery must not disclose an account's existence or confirmation state. */
export function recoveryErrorKey(error: unknown): string {
  const key = authErrorKey(error);
  return key === 'auth.errors.emailLimit' || key === 'auth.errors.requestLimit'
    ? key : 'auth.forgot.sendFailed';
}
