import type { Config } from '@netlify/functions';

import { normalizeUsername, verifyPassword } from '../lib/auth.mts';
import { json, readJson, setAuthCookies } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';
import { createSession } from '../lib/session-store.mts';

export default async function authLogin(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  }

  let body;
  try {
    body = await readJson(request);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const username = normalizeUsername(body?.username);
  const password = String(body?.password ?? '');
  const roleHint = normalizeUsername(body?.role);

  if (!username || !password) return json({ error: 'invalid_input' }, 400);

  try {
    const admin = await getPool().query(`SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`);
    if (!admin.rowCount) return json({ error: 'setup_required' }, 409);

    const { rows } = await getPool().query(
      `SELECT id, username, password_hash, role, display_name
       FROM users
       WHERE lower(username) = lower($1)
       LIMIT 1`,
      [username],
    );
    const user = rows[0];
    const valid = user ? await verifyPassword(password, user.password_hash) : false;
    if (!valid) return json({ error: 'invalid_credentials' }, 401);
    if (roleHint && roleHint !== user.role) return json({ error: 'invalid_credentials' }, 401);

    const session = await createSession(user.id);
    const response = json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        display_name: user.display_name ?? user.username,
      },
    });
    return setAuthCookies(response, session.token, session.csrf);
  } catch (error) {
    console.error('CharacterForge login failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = {
  path: '/api/auth/login',
};
