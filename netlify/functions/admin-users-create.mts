import type { Config } from '@netlify/functions';

import { hashPassword, normalizeUsername } from '../lib/auth.mts';
import { requireCsrf, requireSession } from '../lib/guard.mts';
import { json, readJson } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';

const ROLES = new Set(['admin', 'dm', 'player']);

export default async function createAdminUser(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  const auth = await requireSession(request, ['admin']);
  if (auth.response) return auth.response;
  const csrfError = requireCsrf(request, auth.session);
  if (csrfError) return csrfError;

  let body;
  try { body = await readJson(request); }
  catch { return json({ error: 'invalid_json' }, 400); }

  const username = normalizeUsername(body?.username);
  const password = String(body?.password ?? '').trim();
  const role = String(body?.role ?? 'player').trim();
  const displayName = String(body?.display_name ?? '').trim() || username;
  if (!username || username.length > 80 || displayName.length > 120 || !ROLES.has(role)) {
    return json({ error: 'invalid_input' }, 400);
  }
  if (password.length < 12) return json({ error: 'password_too_short' }, 400);

  try {
    const passwordHash = await hashPassword(password);
    const result = await getPool().query(
      `INSERT INTO users (username, password_hash, role, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, role, display_name, created_at`,
      [username, passwordHash, role, displayName],
    );
    return json({ ok: true, user: result.rows[0] }, 201);
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      return json({ error: 'username_unavailable' }, 409);
    }
    console.error('CharacterForge admin user create failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = { path: '/api/admin/users/create' };
