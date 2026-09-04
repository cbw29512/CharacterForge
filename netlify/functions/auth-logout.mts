import type { Config } from '@netlify/functions';

import { clearAuthCookies, csrfToken, json, sessionToken } from '../lib/http.mts';
import { csrfMatches, getSession, revokeSession } from '../lib/session-store.mts';

export default async function authLogout(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  }

  const token = sessionToken(request);
  try {
    const session = await getSession(token);
    if (!session) return clearAuthCookies(json({ ok: true }));

    if (!csrfMatches(session.csrf_hash, csrfToken(request))) {
      return json({ error: 'csrf_invalid' }, 403);
    }

    await revokeSession(token);
    return clearAuthCookies(json({ ok: true }));
  } catch (error) {
    console.error('CharacterForge logout failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = {
  path: '/api/auth/logout',
};
