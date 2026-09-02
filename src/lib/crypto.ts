/**
 * Password hashing for the demo/simulation mode (when Supabase is not configured).
 *
 * Uses the Web Crypto API (SubtleCrypto) with SHA-256 + a random per-user salt.
 * This is NOT production-grade security — it only prevents plaintext passwords
 * from sitting in localStorage. The real auth flow uses Supabase Auth.
 */

const encoder = new TextEncoder();

/** Generate a random 16-byte salt as a hex string. */
function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Hash a password + salt with SHA-256, returning a hex string. */
async function hashPassword(password: string, salt: string): Promise<string> {
  const data = encoder.encode(`${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Hash a plaintext password, generating a new salt. Returns `${salt}:${hash}`. */
export async function hashUserPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const hash = await hashPassword(password, salt);
  return `${salt}:${hash}`;
}

/** Verify a plaintext password against a stored `${salt}:${hash}` string. */
export async function verifyUserPassword(password: string, stored: string): Promise<boolean> {
  const colonIndex = stored.indexOf(':');
  if (colonIndex === -1) return false;
  const salt = stored.slice(0, colonIndex);
  const hash = stored.slice(colonIndex + 1);
  const computed = await hashPassword(password, salt);
  return computed === hash;
}

/** Generate a random human-readable password (8 chars, alphanumeric). */
export function generateRandomPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
