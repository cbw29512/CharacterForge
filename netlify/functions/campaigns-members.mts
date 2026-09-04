import type { Config } from '@netlify/functions';

import { canManageCampaign } from '../lib/campaign-access.mts';
import { requireSession } from '../lib/guard.mts';
import { json } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';

export default async function campaignMembers(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  const auth = await requireSession(request, ['dm', 'admin']);
  if (auth.response) return auth.response;

  const campaignId = Number(new URL(request.url).searchParams.get('campaign_id'));
  if (!Number.isSafeInteger(campaignId) || campaignId <= 0) return json({ error: 'invalid_input' }, 400);

  try {
    if (!(await canManageCampaign(auth.session, campaignId))) return json({ error: 'forbidden' }, 403);
    const { rows } = await getPool().query(
      `SELECT
         m.id,
         m.campaign_id,
         m.user_id,
         m.role AS membership_role,
         m.approved,
         u.username,
         u.display_name,
         u.role AS account_role,
         (c.dm_id = u.id) AS is_owner
       FROM campaign_memberships m
       JOIN users u ON u.id = m.user_id
       JOIN campaigns c ON c.id = m.campaign_id
       WHERE m.campaign_id = $1
       ORDER BY is_owner DESC, m.approved ASC, COALESCE(u.display_name, u.username), u.id`,
      [campaignId],
    );
    return json({ members: rows });
  } catch (error) {
    console.error('CharacterForge campaign member list failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = { path: '/api/campaigns/members' };
