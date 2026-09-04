import type { Config } from '@netlify/functions';

import { requireSession } from '../lib/guard.mts';
import { json } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';

export default async function browseCampaigns(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  const auth = await requireSession(request);
  if (auth.response) return auth.response;

  try {
    const { rows } = await getPool().query(
      `SELECT c.id, c.name, c.description, c.dm_id, c.is_active, c.created_at
       FROM campaigns c
       WHERE c.is_active = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM campaign_memberships m
           WHERE m.campaign_id = c.id AND m.user_id = $1
         )
       ORDER BY c.created_at DESC`,
      [auth.session.id],
    );
    return json({ campaigns: rows });
  } catch (error) {
    console.error('CharacterForge campaign browse failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = { path: '/api/campaigns/browse' };
