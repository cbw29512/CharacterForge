import type { Config } from '@netlify/functions';

import { canDeleteCharacter, canViewCharacter } from '../lib/character-access.mts';
import { canSaveCharacterAsTemplate } from '../lib/template-access.mts';
import { requireSession } from '../lib/guard.mts';
import { json } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';

export default async function characters(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  const auth = await requireSession(request);
  if (auth.response) return auth.response;

  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: 'invalid_input' }, 400);

  try {
    const result = await getPool().query(
      `SELECT
         id, owner_id, campaign_id, is_npc, name, level, char_class, subclass,
         race, background, alignment, experience_points,
         strength, dexterity, constitution, intelligence, wisdom, charisma,
         max_hp, current_hp, temp_hp, armor_class, initiative, speed,
         proficiency_bonus, hit_dice, skills, saving_throws, equipment, spells,
         features, traits, attacks, notes, build_step, build_complete, created_at, updated_at
       FROM characters
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    const character = result.rows[0];
    if (!character) return json({ error: 'not_found' }, 404);
    if (!(await canViewCharacter(auth.session, character))) return json({ error: 'forbidden' }, 403);
    const [canDelete, canSaveTemplate] = await Promise.all([
      canDeleteCharacter(auth.session, character),
      canSaveCharacterAsTemplate(auth.session, character),
    ]);
    return json({ character, can_delete: canDelete, can_save_template: canSaveTemplate });
  } catch (error) {
    console.error('CharacterForge character read failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = { path: '/api/characters' };
