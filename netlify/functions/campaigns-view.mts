import type { Config } from '@netlify/functions';

import { canAccessCampaign, canManageCampaign } from '../lib/campaign-access.mts';
import { requireSession } from '../lib/guard.mts';
import { json } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';

export default async function campaignView(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  const auth = await requireSession(request);
  if (auth.response) return auth.response;

  const campaignId = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isSafeInteger(campaignId) || campaignId <= 0) return json({ error: 'invalid_input' }, 400);

  try {
    const campaignResult = await getPool().query(
      `SELECT id, name, description, dm_id, is_active, created_at
       FROM campaigns WHERE id = $1 LIMIT 1`,
      [campaignId],
    );
    const campaign = campaignResult.rows[0];
    if (!campaign) return json({ error: 'not_found' }, 404);
    if (!(await canAccessCampaign(auth.session, campaignId))) return json({ error: 'forbidden' }, 403);

    const isDm = await canManageCampaign(auth.session, campaignId);
    const characterResult = await getPool().query(
      `SELECT id, owner_id, campaign_id, is_npc, name, level, char_class, race,
              armor_class, current_hp, max_hp, build_complete
       FROM characters
       WHERE campaign_id = $1
       ORDER BY is_npc ASC, name ASC, id ASC`,
      [campaignId],
    );
    const pcCharacters = characterResult.rows.filter((row) => !row.is_npc);
    const npcCharacters = characterResult.rows.filter((row) => row.is_npc);
    const myCharacter = pcCharacters.find((row) => row.owner_id === auth.session.id) ?? null;

    let members = [];
    let pending = [];
    if (isDm) {
      const membershipResult = await getPool().query(
        `SELECT m.id, m.user_id, m.role AS membership_role, m.approved,
                u.username, u.display_name, u.role AS user_role
         FROM campaign_memberships m
         JOIN users u ON u.id = m.user_id
         WHERE m.campaign_id = $1
         ORDER BY m.approved DESC, COALESCE(u.display_name, u.username), u.username`,
        [campaignId],
      );
      members = membershipResult.rows.filter((row) => row.approved);
      pending = membershipResult.rows.filter((row) => !row.approved);
    }

    return json({
      campaign,
      is_dm: isDm,
      pc_characters: pcCharacters,
      npc_characters: npcCharacters,
      members,
      pending,
      my_character: myCharacter,
    });
  } catch (error) {
    console.error('CharacterForge campaign view failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = { path: '/api/campaigns/view' };
