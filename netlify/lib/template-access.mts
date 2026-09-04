import { getPool } from './pg.mts';

type Session = { id: number; role: 'admin' | 'dm' | 'player' };
type Character = { owner_id: number | null; campaign_id: number | null };

export async function canSaveCharacterAsTemplate(session: Session, character: Character) {
  if (session.role === 'admin') return true;
  if (character.owner_id === session.id) return true;
  if (session.role === 'dm' && character.campaign_id) {
    const result = await getPool().query(
      `SELECT 1 FROM campaigns WHERE id = $1 AND dm_id = $2 LIMIT 1`,
      [character.campaign_id, session.id],
    );
    return Boolean(result.rowCount);
  }
  return false;
}
