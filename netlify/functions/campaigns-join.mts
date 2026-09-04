import type { Config } from '@netlify/functions';

import { campaignExists } from '../lib/campaign-access.mts';
import { requireCsrf, requireSession } from '../lib/guard.mts';
import { json, readJson } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';

export default async function joinCampaign(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const csrfError = requireCsrf(request, auth.session);
  if (csrfError) return csrfError;

  let body;
  try { body = await readJson(request); }
  catch { return json({ error: 'invalid_json' }, 400); }
  const campaignId = Number(body?.campaign_id);
  if (!Number.isSafeInteger(campaignId) || campaignId <= 0) return json({ error: 'invalid_input' }, 400);

  try {
    if (!(await campaignExists(campaignId))) return json({ error: 'not_found' }, 404);
    const result = await getPool().query(
      `INSERT INTO campaign_memberships (campaign_id, user_id, role, approved)
       VALUES ($1, $2, 'player', FALSE)
       ON CONFLICT (campaign_id, user_id) DO NOTHING
       RETURNING id, campaign_id, user_id, role, approved`,
      [campaignId, auth.session.id],
    );
    if (!result.rowCount) return json({ error: 'membership_exists' }, 409);
    return json({ ok: true, membership: result.rows[0] }, 201);
  } catch (error) {
    console.error('CharacterForge campaign join failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = { path: '/api/campaigns/join' };
