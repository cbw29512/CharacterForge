import type { Config } from '@netlify/functions';

import { requireSession } from '../lib/guard.mts';
import { json } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';

export default async function adminOverview(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  const auth = await requireSession(request, ['admin']);
  if (auth.response) return auth.response;

  try {
    const [users, campaigns, counts] = await Promise.all([
      getPool().query(`SELECT id, username, role, display_name, created_at FROM users ORDER BY role, lower(username), id`),
      getPool().query(`SELECT c.id, c.name, c.description, c.dm_id, c.created_at,
                              COALESCE(u.display_name, u.username) AS dm_name
                       FROM campaigns c JOIN users u ON u.id = c.dm_id
                       ORDER BY c.created_at DESC, c.id DESC`),
      getPool().query(`SELECT
        (SELECT COUNT(*)::int FROM users) AS user_count,
        (SELECT COUNT(*)::int FROM campaigns) AS campaign_count,
        (SELECT COUNT(*)::int FROM characters) AS character_count`),
    ]);
    return json({ users: users.rows, campaigns: campaigns.rows, counts: counts.rows[0] });
  } catch (error) {
    console.error('CharacterForge admin overview failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = { path: '/api/admin/overview' };
