import type { Config } from '@netlify/functions';

import { requireCsrf, requireSession } from '../lib/guard.mts';
import { json, readJson } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';
import { canSaveCharacterAsTemplate } from '../lib/template-access.mts';

export default async function saveTemplate(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const csrfError = requireCsrf(request, auth.session);
  if (csrfError) return csrfError;

  let body;
  try { body = await readJson(request); }
  catch { return json({ error: 'invalid_json' }, 400); }

  const characterId = Number(body?.character_id);
  const name = String(body?.name ?? '').trim();
  const description = String(body?.description ?? '').trim();
  if (!Number.isSafeInteger(characterId) || characterId <= 0 || !name || name.length > 200) {
    return json({ error: 'invalid_input' }, 400);
  }

  try {
    const characterResult = await getPool().query(
      `SELECT id, owner_id, campaign_id, is_npc, race, char_class, background, alignment,
              level, strength, dexterity, constitution, intelligence, wisdom, charisma,
              traits, notes
       FROM characters WHERE id = $1 LIMIT 1`,
      [characterId],
    );
    const character = characterResult.rows[0];
    if (!character) return json({ error: 'not_found' }, 404);
    if (!(await canSaveCharacterAsTemplate(auth.session, character))) return json({ error: 'forbidden' }, 403);

    const duplicate = await getPool().query(
      `SELECT 1 FROM character_templates WHERE owner_id = $1 AND name = $2 LIMIT 1`,
      [auth.session.id, name],
    );
    if (duplicate.rowCount) return json({ error: 'template_name_exists' }, 409);

    const result = await getPool().query(
      `INSERT INTO character_templates (
         owner_id, name, is_npc_template, description, race, char_class, background,
         alignment, level, strength, dexterity, constitution, intelligence, wisdom,
         charisma, traits, notes
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12, $13, $14,
         $15, $16::jsonb, $17
       )
       RETURNING id, owner_id, name, is_npc_template, description, race, char_class,
                 background, alignment, level, strength, dexterity, constitution,
                 intelligence, wisdom, charisma, traits, notes, times_used, created_at`,
      [
        auth.session.id, name, character.is_npc, description || null, character.race,
        character.char_class, character.background, character.alignment, character.level,
        character.strength, character.dexterity, character.constitution,
        character.intelligence, character.wisdom, character.charisma,
        JSON.stringify(character.traits ?? {}), character.notes,
      ],
    );
    return json({ ok: true, template: result.rows[0] }, 201);
  } catch (error) {
    console.error('CharacterForge template save failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = { path: '/api/templates/save' };
