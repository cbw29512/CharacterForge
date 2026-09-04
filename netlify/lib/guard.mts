import { csrfToken, json, sessionToken } from './http.mts';
import { csrfMatches, getSession } from './session-store.mts';

export type AllowedRole = 'admin' | 'dm' | 'player';

export async function requireSession(request: Request, roles: AllowedRole[] = []) {
  const session = await getSession(sessionToken(request));
  if (!session) {
    return { session: null, response: json({ error: 'unauthorized' }, 401) };
  }
  if (roles.length && !roles.includes(session.role)) {
    return { session: null, response: json({ error: 'forbidden' }, 403) };
  }
  return { session, response: null };
}

export function requireCsrf(request: Request, session: { csrf_hash: string }) {
  if (!csrfMatches(session.csrf_hash, csrfToken(request))) {
    return json({ error: 'csrf_invalid' }, 403);
  }
  return null;
}
