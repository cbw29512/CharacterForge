import type { Config } from '@netlify/functions';

import { canManageCampaign } from '../lib/campaign-access.mts';
import { requireCsrf, requireSession } from '../lib/guard.mts';
import { json, readJson } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';

export default async function approveCampaignMember(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  const auth = await requireSession(request, ['dm', 'admin']);
  if (auth.response) return auth.response;
  const csrfError = requireCsrf(request, auth.session);
  if (csrfError) return csrfError;

  let body;
  try { body = await readJson(request); }
  catch { return json({ error: 'invalid_json' }, 400); }
  const campaignId = Number(body?.campaign_id);
  const userId = Number(body?.user_id);
  if (![campaignId, userId].every((value) => Number.isSafeInteger(value) && value > 0)) return json({ error: 'invalid_input' }, 400);

  try {
    if (!(await canManageCampaign(auth.session, campaignId))) return json({ error: 'forbidden' }, 403);
    const target = await getPool().query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [userId]);
    if (!target.rowCount) return json({ error: 'not_found' }, 404);
    if (target.rows[0].role === 'dm' && auth.session.role !== 'admin') return json({ error: 'forbidden' }, 403);

    const result = await getPool().query(
      `UPDATE campaign_memberships
       SET approved = TRUE
       WHERE campaign_id = $1 AND user_id = $2
       RETURNING id, campaign_id, user_id, role, approved`,
      [campaignId, userId],
    );
    if (!result.rowCount) return json({ error: 'not_found' }, 404);
    return json({ ok: true, membership: result.rows[0] });
  } catch (error) {
    console.error('CharacterForge campaign approval failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = { path: '/api/campaigns/approve' };
