/**
 * Secure token generation and hashing for parental consent.
 */

/**
 * Generates a random secure token.
 * @returns {string} The raw token.
 */
export function generateConsentToken(): string {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hashes a token using SHA-256.
 * @param {string} token The raw token to hash.
 * @returns {Promise<string>} The hashed token.
 */
export async function hashConsentToken(token: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(token);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
