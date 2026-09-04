import type { Config } from '@netlify/functions';

import { requireSession } from '../lib/guard.mts';
import { json } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';

export default async function templates(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  const auth = await requireSession(request);
  if (auth.response) return auth.response;

  const isNpc = new URL(request.url).searchParams.get('npc') === 'true';
  try {
    const { rows } = await getPool().query(
      `SELECT id, owner_id, name, is_npc_template, description, race, char_class,
              background, alignment, level, strength, dexterity, constitution,
              intelligence, wisdom, charisma, traits, notes, times_used, created_at
       FROM character_templates
       WHERE owner_id = $1 AND is_npc_template = $2
       ORDER BY times_used DESC, created_at DESC`,
      [auth.session.id, isNpc],
    );
    return json({ templates: rows });
  } catch (error) {
    console.error('CharacterForge template list failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = { path: '/api/templates' };
