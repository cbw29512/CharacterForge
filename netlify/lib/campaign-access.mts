import { getPool } from './pg.mts';

export async function canManageCampaign(session: { id: number; role: string }, campaignId: number) {
  if (session.role === 'admin') return true;
  if (session.role !== 'dm') return false;
  const result = await getPool().query(
    `SELECT 1 FROM campaigns WHERE id = $1 AND dm_id = $2 LIMIT 1`,
    [campaignId, session.id],
  );
  return Boolean(result.rowCount);
}

export async function campaignExists(campaignId: number) {
  const result = await getPool().query(`SELECT 1 FROM campaigns WHERE id = $1 LIMIT 1`, [campaignId]);
  return Boolean(result.rowCount);
}
