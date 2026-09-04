import type { Config } from '@netlify/functions';

import { hashPassword } from '../lib/auth.mts';
import { requireCsrf, requireSession } from '../lib/guard.mts';
import { json, readJson } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';

export default async function resetAdminUserPassword(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  const auth = await requireSession(request, ['admin']);
  if (auth.response) return auth.response;
  const csrfError = requireCsrf(request, auth.session);
  if (csrfError) return csrfError;

  let body;
  try { body = await readJson(request); }
  catch { return json({ error: 'invalid_json' }, 400); }
  const userId = Number(body?.user_id);
  const password = String(body?.password ?? '').trim();
  if (!Number.isSafeInteger(userId) || userId <= 0) return json({ error: 'invalid_input' }, 400);
  if (password.length < 12) return json({ error: 'password_too_short' }, 400);

  const client = await getPool().connect();
  try {
    const passwordHash = await hashPassword(password);
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, username`,
      [passwordHash, userId],
    );
    if (!updated.rowCount) { await client.query('ROLLBACK'); return json({ error: 'not_found' }, 404); }
    await client.query(`UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
    await client.query('COMMIT');
    return json({ ok: true, user_id: userId, sessions_revoked: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('CharacterForge admin password reset failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  } finally {
    client.release();
  }
}

export const config: Config = { path: '/api/admin/users/password' };
