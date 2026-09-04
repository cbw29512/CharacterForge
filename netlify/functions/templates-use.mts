import type { Config } from '@netlify/functions';

import { requireCsrf, requireSession } from '../lib/guard.mts';
import { json, readJson } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';

export default async function useTemplate(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const csrfError = requireCsrf(request, auth.session);
  if (csrfError) return csrfError;

  let body;
  try { body = await readJson(request); }
  catch { return json({ error: 'invalid_json' }, 400); }
  const templateId = Number(body?.template_id);
  if (!Number.isSafeInteger(templateId) || templateId <= 0) return json({ error: 'invalid_input' }, 400);

  try {
    const result = await getPool().query(
      `UPDATE character_templates
       SET times_used = times_used + 1
       WHERE id = $1 AND (owner_id = $2 OR $3 = 'admin')
       RETURNING id, owner_id, name, is_npc_template, description, race, char_class,
                 background, alignment, level, strength, dexterity, constitution,
                 intelligence, wisdom, charisma, traits, notes, times_used, created_at`,
      [templateId, auth.session.id, auth.session.role],
    );
    if (!result.rowCount) {
      const exists = await getPool().query(`SELECT 1 FROM character_templates WHERE id = $1`, [templateId]);
      return json({ error: exists.rowCount ? 'forbidden' : 'not_found' }, exists.rowCount ? 403 : 404);
    }
    return json({ ok: true, template: result.rows[0] });
  } catch (error) {
    console.error('CharacterForge template use failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = { path: '/api/templates/use' };
