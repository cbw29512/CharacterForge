import type { Config } from '@netlify/functions';

import { json, sessionToken } from '../lib/http.mts';
import { getSession } from '../lib/session-store.mts';

export default async function authMe(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }

  try {
    const session = await getSession(sessionToken(request));
    if (!session) return json({ error: 'unauthorized' }, 401);

    return json({
      ok: true,
      user: {
        id: session.id,
        username: session.username,
        role: session.role,
        display_name: session.display_name ?? session.username,
      },
    });
  } catch (error) {
    console.error('CharacterForge session lookup failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = {
  path: '/api/auth/me',
};
