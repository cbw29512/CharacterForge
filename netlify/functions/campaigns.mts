import type { Config } from '@netlify/functions';

import { requireCsrf, requireSession } from '../lib/guard.mts';
import { json, readJson } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';

export default async function campaigns(request: Request): Promise<Response> {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const session = auth.session;

  if (request.method === 'GET') {
    try {
      let query;
      let params;
      if (session.role === 'admin') {
        query = `SELECT id, name, description, dm_id, is_active, created_at
                 FROM campaigns ORDER BY created_at DESC`;
        params = [];
      } else if (session.role === 'dm') {
        query = `SELECT id, name, description, dm_id, is_active, created_at
                 FROM campaigns WHERE dm_id = $1 ORDER BY created_at DESC`;
        params = [session.id];
      } else {
        query = `SELECT c.id, c.name, c.description, c.dm_id, c.is_active, c.created_at
                 FROM campaigns c
                 JOIN campaign_memberships m ON m.campaign_id = c.id
                 WHERE m.user_id = $1 AND m.approved = TRUE
                 ORDER BY c.created_at DESC`;
        params = [session.id];
      }
      const { rows } = await getPool().query(query, params);
      return json({ campaigns: rows });
    } catch (error) {
      console.error('CharacterForge campaign list failed', error instanceof Error ? error.name : 'unknown_error');
      return json({ error: 'service_unavailable' }, 503);
    }
  }

  if (request.method === 'POST') {
    if (!['dm', 'admin'].includes(session.role)) return json({ error: 'forbidden' }, 403);
    const csrfError = requireCsrf(request, session);
    if (csrfError) return csrfError;

    let body;
    try {
      body = await readJson(request);
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }
    const name = String(body?.name ?? '').trim();
    const description = String(body?.description ?? '').trim();
    if (!name || name.length > 200) return json({ error: 'invalid_input' }, 400);

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const created = await client.query(
        `INSERT INTO campaigns (name, description, dm_id)
         VALUES ($1, $2, $3)
         RETURNING id, name, description, dm_id, is_active, created_at`,
        [name, description || null, session.id],
      );
      const campaign = created.rows[0];
      await client.query(
        `INSERT INTO campaign_memberships (campaign_id, user_id, role, approved)
         VALUES ($1, $2, 'dm', TRUE)`,
        [campaign.id, session.id],
      );
      await client.query('COMMIT');
      return json({ ok: true, campaign }, 201);
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch {}
      console.error('CharacterForge campaign create failed', error instanceof Error ? error.name : 'unknown_error');
      return json({ error: 'service_unavailable' }, 503);
    } finally {
      client.release();
    }
  }

  return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
}

export const config: Config = {
  path: '/api/campaigns',
};
