import type { Config } from '@netlify/functions';

import { canDeleteCharacter } from '../lib/character-access.mts';
import { requireCsrf, requireSession } from '../lib/guard.mts';
import { json, readJson } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';

export default async function deleteCharacter(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const csrfError = requireCsrf(request, auth.session);
  if (csrfError) return csrfError;

  let body;
  try { body = await readJson(request); }
  catch { return json({ error: 'invalid_json' }, 400); }
  const id = Number(body?.id);
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: 'invalid_input' }, 400);

  try {
    const result = await getPool().query(
      `SELECT id, owner_id, campaign_id, is_npc FROM characters WHERE id = $1 LIMIT 1`,
      [id],
    );
    const character = result.rows[0];
    if (!character) return json({ error: 'not_found' }, 404);
    if (!(await canDeleteCharacter(auth.session, character))) return json({ error: 'forbidden' }, 403);

    await getPool().query(`DELETE FROM characters WHERE id = $1`, [id]);
    return json({ ok: true });
  } catch (error) {
    console.error('CharacterForge character delete failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = { path: '/api/characters/delete' };
