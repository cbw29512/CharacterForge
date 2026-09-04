import type { Config } from '@netlify/functions';

import { requireCsrf, requireSession } from '../lib/guard.mts';
import { json, readJson } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';

const ROLES = new Set(['admin', 'dm', 'player']);
const ADMIN_LOCK = 724016;

export default async function changeAdminUserRole(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  const auth = await requireSession(request, ['admin']);
  if (auth.response) return auth.response;
  const csrfError = requireCsrf(request, auth.session);
  if (csrfError) return csrfError;

  let body;
  try { body = await readJson(request); }
  catch { return json({ error: 'invalid_json' }, 400); }
  const userId = Number(body?.user_id);
  const role = String(body?.role ?? '').trim();
  if (!Number.isSafeInteger(userId) || userId <= 0 || !ROLES.has(role)) return json({ error: 'invalid_input' }, 400);

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [ADMIN_LOCK]);
    const targetResult = await client.query(`SELECT id, username, role, display_name FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    const target = targetResult.rows[0];
    if (!target) { await client.query('ROLLBACK'); return json({ error: 'not_found' }, 404); }
    if (target.role === 'admin' && role !== 'admin') {
      const count = await client.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'`);
      if (count.rows[0].count <= 1) { await client.query('ROLLBACK'); return json({ error: 'last_admin_required' }, 409); }
    }
    const updated = await client.query(
      `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role, display_name, created_at`,
      [role, userId],
    );
    await client.query('COMMIT');
    return json({ ok: true, user: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('CharacterForge admin role change failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  } finally {
    client.release();
  }
}

export const config: Config = { path: '/api/admin/users/role' };
