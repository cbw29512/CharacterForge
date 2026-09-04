import { getPool } from './pg.mts';

export type CharacterAccessRow = {
  id: number;
  owner_id: number | null;
  campaign_id: number | null;
  is_npc: boolean;
};

type Session = { id: number; role: 'admin' | 'dm' | 'player' };

export async function canAccessCampaign(session: Session, campaignId: number) {
  if (session.role === 'admin') return true;
  const result = await getPool().query(
    `SELECT 1
     FROM campaigns c
     LEFT JOIN campaign_memberships m
       ON m.campaign_id = c.id AND m.user_id = $2 AND m.approved = TRUE
     WHERE c.id = $1
       AND (c.dm_id = $2 OR m.id IS NOT NULL)
     LIMIT 1`,
    [campaignId, session.id],
  );
  return Boolean(result.rowCount);
}

export async function canCreateInCampaign(session: Session, campaignId: number | null, isNpc: boolean) {
  if (!campaignId) return true;
  if (session.role === 'admin') {
    const exists = await getPool().query(`SELECT 1 FROM campaigns WHERE id = $1 LIMIT 1`, [campaignId]);
    return Boolean(exists.rowCount);
  }
  if (isNpc) {
    if (session.role !== 'dm') return false;
    const owned = await getPool().query(`SELECT 1 FROM campaigns WHERE id = $1 AND dm_id = $2 LIMIT 1`, [campaignId, session.id]);
    return Boolean(owned.rowCount);
  }
  return canAccessCampaign(session, campaignId);
}

export async function canViewCharacter(session: Session, character: CharacterAccessRow) {
  if (session.role === 'admin' || character.owner_id === session.id) return true;
  if (!character.campaign_id) return false;
  return canAccessCampaign(session, character.campaign_id);
}

export async function canDeleteCharacter(session: Session, character: CharacterAccessRow) {
  if (session.role === 'admin') return true;
  if (session.role === 'player') return character.owner_id === session.id && !character.is_npc;
  if (character.campaign_id) {
    const owned = await getPool().query(
      `SELECT 1 FROM campaigns WHERE id = $1 AND dm_id = $2 LIMIT 1`,
      [character.campaign_id, session.id],
    );
    if (owned.rowCount) return true;
  }
  return character.is_npc && character.owner_id === session.id;
}
