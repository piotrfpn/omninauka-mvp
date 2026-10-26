/** Server-side, dormant identifier utilities. No Auth, database or email client. */
export const MANAGED_CHILD_ALPHABET = '23456789abcdefghjklmnpqrstuvwxyz';
export const MANAGED_CHILD_CODE_LENGTH = 12;
export const MANAGED_CHILD_ENTROPY_BITS = 60;
export const MANAGED_CHILD_RESERVATION_ATTEMPTS = 5;
export const PROPOSED_MANAGED_CHILD_NAMESPACE = 'dzieci.omninauka.eu';

export interface ManagedChildIdentityConfig {
  readonly enabled: boolean;
  readonly namespace: string;
}

export interface ManagedChildIdentityCandidate {
  readonly loginCode: string;
  readonly loginIdentifier: string;
  readonly technicalEmail: string;
  readonly namespace: string;
}

function assertServerRuntime(): void {
  if (typeof window !== 'undefined') throw new Error('managed_child_server_only');
}

function normalizeNamespace(value: string): string {
  // A DNS-shaped name is not evidence of domain ownership or operational readiness.
  const label = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
  if (typeof value !== 'string' || !/^[A-Za-z0-9.-]+$/.test(value)) {
    throw new Error('invalid_managed_child_namespace');
  }
  const namespace = value.toLowerCase();
  if (namespace.length > 253 || !new RegExp(`^${label}(?:\\.${label})+\\.[a-z]{2,63}$`).test(namespace)) {
    throw new Error('invalid_managed_child_namespace');
  }
  return namespace;
}

/** Pass a server-side environment reader explicitly; importing reads no environment. */
export function readManagedChildIdentityConfig(
  read: (name: string) => string | undefined = () => undefined,
): ManagedChildIdentityConfig {
  assertServerRuntime();
  return Object.freeze({
    enabled: read('MANAGED_CHILD_IDENTITIES_ENABLED') === 'true',
    namespace: normalizeNamespace(read('MANAGED_CHILD_IDENTITY_NAMESPACE') ?? PROPOSED_MANAGED_CHILD_NAMESPACE),
  });
}

/** Only ASCII case folding and exact optional 4-4-4 grouping; no fuzzy matching. */
export function normalizeManagedChildLogin(value: unknown): string {
  assertServerRuntime();
  if (typeof value !== 'string') throw new Error('invalid_managed_child_login');
  const alphabet = MANAGED_CHILD_ALPHABET + MANAGED_CHILD_ALPHABET.toUpperCase();
  const code = `[${alphabet}]`;
  const pattern = new RegExp(`^(?:[Uu][Cc][Zz][Ee][Nn]-)?(${code}{12}|${code}{4}-${code}{4}-${code}{4})$`);
  const match = pattern.exec(value.trim());
  if (!match) throw new Error('invalid_managed_child_login');
  return match[1].replaceAll('-', '').toLowerCase();
}

export function presentManagedChildLogin(value: unknown): string {
  const code = normalizeManagedChildLogin(value).toUpperCase();
  return `UCZEN-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
}

/** Pure derivation; this address does not represent a child's personal mailbox. */
export function deriveManagedChildTechnicalEmail(value: unknown, namespace: string): string {
  return `u-${normalizeManagedChildLogin(value)}@${normalizeNamespace(namespace)}`;
}

export function generateManagedChildIdentity(config: ManagedChildIdentityConfig): ManagedChildIdentityCandidate {
  assertServerRuntime();
  if (config.enabled !== true) throw new Error('managed_child_identity_disabled');
  const namespace = normalizeNamespace(config.namespace);
  const bytes = new Uint8Array(MANAGED_CHILD_CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  // 32 symbols: 256 is divisible by 32, so masking introduces no modulo bias.
  const loginCode = Array.from(bytes, byte => MANAGED_CHILD_ALPHABET[byte & 31]).join('');
  return Object.freeze({
    loginCode,
    loginIdentifier: presentManagedChildLogin(loginCode),
    technicalEmail: deriveManagedChildTechnicalEmail(loginCode, namespace),
    namespace,
  });
}

/**
 * Future trusted reservation adapter only. It must commit a DB reservation and
 * classify ONLY the login-code/technical-email unique conflict as a collision.
 * This callback is not parental authorization and must never call Auth here.
 * Other uniqueness/ownership/idempotency errors must propagate without retry.
 */
export async function reserveManagedChildIdentifier(
  config: ManagedChildIdentityConfig,
  tryReserve: (candidate: ManagedChildIdentityCandidate) => Promise<'reserved' | 'identifier_collision'>,
): Promise<ManagedChildIdentityCandidate> {
  for (let attempt = 0; attempt < MANAGED_CHILD_RESERVATION_ATTEMPTS; attempt++) {
    const candidate = generateManagedChildIdentity(config);
    const result = await tryReserve(candidate);
    if (result === 'reserved') return candidate;
    if (result !== 'identifier_collision') throw new Error('invalid_managed_child_reservation_result');
  }
  throw new Error('managed_child_identifier_collision_limit');
}
