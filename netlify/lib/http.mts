import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  csrfCookieOptions,
  sessionCookieOptions,
} from './auth.mts';

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

export async function readJson(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new Error('content_type');
  }
  return request.json();
}

export function parseCookies(request: Request) {
  const header = request.headers.get('cookie') ?? '';
  const cookies = new Map<string, string>();
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) cookies.set(name, decodeURIComponent(value));
  }
  return cookies;
}

function serializeCookie(name: string, value: string, options: ReturnType<typeof sessionCookieOptions> | ReturnType<typeof csrfCookieOptions>) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path}`, `Max-Age=${Math.max(0, Math.floor(options.maxAge))}`];
  if (options.secure) parts.push('Secure');
  if (options.httpOnly) parts.push('HttpOnly');
  parts.push(`SameSite=${options.sameSite === 'lax' ? 'Lax' : options.sameSite}`);
  return parts.join('; ');
}

export function authCookieHeaders(token: string, csrf: string) {
  const headers = new Headers();
  headers.append('Set-Cookie', serializeCookie(SESSION_COOKIE, token, sessionCookieOptions()));
  headers.append('Set-Cookie', serializeCookie(CSRF_COOKIE, csrf, csrfCookieOptions()));
  return headers;
}

export function clearAuthCookieHeaders() {
  const headers = new Headers();
  headers.append('Set-Cookie', serializeCookie(SESSION_COOKIE, '', sessionCookieOptions(0)));
  headers.append('Set-Cookie', serializeCookie(CSRF_COOKIE, '', csrfCookieOptions(0)));
  return headers;
}

export function sessionToken(request: Request) {
  return parseCookies(request).get(SESSION_COOKIE) ?? null;
}

export function csrfToken(request: Request) {
  return request.headers.get('x-csrf-token') ?? null;
}
