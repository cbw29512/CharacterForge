import type { Config } from '@netlify/functions';

import { canViewCharacter } from '../lib/character-access.mts';
import { requireSession } from '../lib/guard.mts';
import { json } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';

const CHARACTER_COLUMNS = [
  'id', 'owner_id', 'campaign_id', 'is_npc', 'name', 'level', 'char_class', 'subclass',
  'race', 'background', 'alignment', 'experience_points',
  'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
  'max_hp', 'current_hp', 'temp_hp', 'armor_class', 'initiative', 'speed',
  'proficiency_bonus', 'hit_dice', 'skills', 'saving_throws', 'equipment', 'spells',
  'features', 'traits', 'attacks', 'notes', 'build_step', 'build_complete', 'created_at', 'updated_at',
] as const;

const CHARACTER_FIELDS = CHARACTER_COLUMNS.join(', ');
const CHARACTER_FIELDS_WITH_ALIAS = CHARACTER_COLUMNS.map((column) => `ch.${column}`).join(', ');

export default async function characters(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  const auth = await requireSession(request);
  if (auth.response) return auth.response;

  const rawId = new URL(request.url).searchParams.get('id');
  try {
    if (rawId === null) {
      const result = auth.session.role === 'admin'
        ? await getPool().query(`SELECT ${CHARACTER_FIELDS} FROM characters ORDER BY updated_at DESC, id DESC`)
        : await getPool().query(
            `SELECT ${CHARACTER_FIELDS_WITH_ALIAS}
             FROM characters ch
             LEFT JOIN campaigns c ON c.id = ch.campaign_id
             LEFT JOIN campaign_memberships m
               ON m.campaign_id = ch.campaign_id
              AND m.user_id = $1
              AND m.approved = TRUE
             WHERE ch.owner_id = $1
                OR c.dm_id = $1
                OR m.id IS NOT NULL
             ORDER BY ch.updated_at DESC, ch.id DESC`,
            [auth.session.id],
          );
      return json({ characters: result.rows });
    }

    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) return json({ error: 'invalid_input' }, 400);

    const result = await getPool().query(
      `SELECT ${CHARACTER_FIELDS}
       FROM characters
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    const character = result.rows[0];
    if (!character) return json({ error: 'not_found' }, 404);
    if (!(await canViewCharacter(auth.session, character))) return json({ error: 'forbidden' }, 403);
    return json({ character });
  } catch (error) {
    console.error('CharacterForge character read failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = { path: '/api/characters' };
