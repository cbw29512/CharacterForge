import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcrypt';

export const SESSION_COOKIE = '__Host-cf_session';
export const CSRF_COOKIE = '__Host-cf_csrf';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const MIN_PASSWORD_LENGTH = 12;

export function normalizeUsername(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('en-US');
}

export function validatePassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export function randomCredential(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function digestCredential(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function secureCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    path: '/',
    secure: true,
    sameSite: 'lax' as const,
    maxAge,
  };
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    ...secureCookieOptions(maxAge),
    httpOnly: true,
  };
}

export function csrfCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    ...secureCookieOptions(maxAge),
    httpOnly: false,
  };
}
