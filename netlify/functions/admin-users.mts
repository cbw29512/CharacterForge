import type { Config } from '@netlify/functions';

import { hashPassword, normalizeUsername, validatePassword } from '../lib/auth.mts';
import { requireCsrf, requireSession } from '../lib/guard.mts';
import { json, readJson } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';

const ROLES = new Set(['admin', 'dm', 'player']);

export default async function adminUsers(request: Request): Promise<Response> {
  const auth = await requireSession(request, ['admin']);
  if (auth.response) return auth.response;

  if (request.method === 'GET') {
    try {
      const [users, campaigns, characters] = await Promise.all([
        getPool().query(`SELECT id, username, role, display_name, created_at FROM users ORDER BY role, username`),
        getPool().query(`SELECT COUNT(*)::int AS count FROM campaigns`),
        getPool().query(`SELECT COUNT(*)::int AS count FROM characters`),
      ]);
      return json({ users: users.rows, campaign_count: campaigns.rows[0].count, character_count: characters.rows[0].count });
    } catch (error) {
      console.error('CharacterForge admin user list failed', error instanceof Error ? error.name : 'unknown_error');
      return json({ error: 'service_unavailable' }, 503);
    }
  }

  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
  const csrfError = requireCsrf(request, auth.session);
  if (csrfError) return csrfError;

  let body;
  try { body = await readJson(request); }
  catch { return json({ error: 'invalid_json' }, 400); }

  const username = normalizeUsername(body?.username);
  const password = String(body?.password ?? '');
  const role = String(body?.role ?? 'player');
  const displayName = String(body?.display_name ?? username).trim();
  if (!username || username.length > 80 || !ROLES.has(role) || displayName.length > 120) {
    return json({ error: 'invalid_input' }, 400);
  }
  try { validatePassword(password); }
  catch { return json({ error: 'password_too_short' }, 400); }

  try {
    const passwordHash = await hashPassword(password);
    const result = await getPool().query(
      `INSERT INTO users (username, password_hash, role, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, role, display_name, created_at`,
      [username, passwordHash, role, displayName || username],
    );
    return json({ ok: true, user: result.rows[0] }, 201);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return json({ error: 'username_unavailable' }, 409);
    }
    console.error('CharacterForge admin user create failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = { path: '/api/admin/users' };
