import type { Config } from '@netlify/functions';

import { hashPassword, normalizeUsername, validatePassword } from '../lib/auth.mts';
import { json, readJson } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';

const BOOTSTRAP_LOCK_ID = 264166431;

export default async function authSetup(request: Request): Promise<Response> {
  if (request.method === 'GET') {
    try {
      const { rows } = await getPool().query(`SELECT EXISTS (SELECT 1 FROM users WHERE role = 'admin') AS has_admin`);
      return json({ setup_required: !rows[0]?.has_admin });
    } catch (error) {
      console.error('CharacterForge setup status failed', error instanceof Error ? error.name : 'unknown_error');
      return json({ error: 'service_unavailable' }, 503);
    }
  }

  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
  }

  let body;
  try {
    body = await readJson(request);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const username = normalizeUsername(body?.username);
  const password = String(body?.password ?? '');
  const confirm = String(body?.confirm ?? '');
  const displayName = String(body?.display_name ?? username).trim();

  if (!username || username.length > 80 || !password) {
    return json({ error: 'invalid_input' }, 400);
  }
  if (displayName.length > 120) {
    return json({ error: 'invalid_input' }, 400);
  }
  if (password !== confirm) {
    return json({ error: 'password_mismatch' }, 400);
  }
  try {
    validatePassword(password);
  } catch {
    return json({ error: 'password_too_short' }, 400);
  }

  const passwordHash = await hashPassword(password);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [BOOTSTRAP_LOCK_ID]);

    const existing = await client.query(`SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`);
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      return json({ error: 'setup_complete' }, 409);
    }

    const result = await client.query(
      `INSERT INTO users (username, password_hash, role, display_name)
       VALUES ($1, $2, 'admin', $3)
       RETURNING id, username, role, display_name`,
      [username, passwordHash, displayName || username],
    );
    await client.query('COMMIT');
    return json({ ok: true, user: result.rows[0] }, 201);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return json({ error: 'username_unavailable' }, 409);
    }
    console.error('CharacterForge admin bootstrap failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  } finally {
    client.release();
  }
}

export const config: Config = {
  path: '/api/auth/setup',
};
