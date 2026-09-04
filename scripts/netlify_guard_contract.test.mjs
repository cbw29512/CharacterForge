import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { NetlifyDB } from '@netlify/database-dev';
import pg from 'pg';

let db;
let connectionString;
let requireSession;
let requireCsrf;
let createSession;
let closePool;
let playerId;
let session;
const originalDatabaseUrl = process.env.NETLIFY_DB_URL;

before(async () => {
  db = new NetlifyDB({ logger: () => {} });
  connectionString = await db.start();
  await db.applyMigrations('./netlify/database/migrations');
  process.env.NETLIFY_DB_URL = connectionString;

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(
      `INSERT INTO users (username, password_hash, role) VALUES ('guard-player', 'hash', 'player') RETURNING id`,
    );
    playerId = result.rows[0].id;
  } finally {
    await client.end();
  }

  ({ requireSession, requireCsrf } = await import('../netlify/lib/guard.mts'));
  ({ createSession } = await import('../netlify/lib/session-store.mts'));
  ({ __closePoolForTests: closePool } = await import('../netlify/lib/pg.mts'));
  session = await createSession(playerId);
});

after(async () => {
  if (closePool) await closePool();
  if (originalDatabaseUrl === undefined) delete process.env.NETLIFY_DB_URL;
  else process.env.NETLIFY_DB_URL = originalDatabaseUrl;
  if (db) await db.stop();
});

function request({ csrf } = {}) {
  const headers = { cookie: `__Host-cf_session=${encodeURIComponent(session.token)}` };
  if (csrf !== undefined) headers['x-csrf-token'] = csrf;
  return new Request('http://localhost/api/protected', { method: 'POST', headers });
}

test('missing sessions are rejected', async () => {
  const result = await requireSession(new Request('http://localhost/api/protected'), ['player']);
  assert.equal(result.session, null);
  assert.equal(result.response.status, 401);
});

test('role guard rejects insufficient roles and permits allowed roles', async () => {
  const denied = await requireSession(request(), ['admin']);
  assert.equal(denied.response.status, 403);

  const allowed = await requireSession(request(), ['player']);
  assert.equal(allowed.response, null);
  assert.equal(allowed.session.role, 'player');
});

test('CSRF guard is bound to the active server-side session', async () => {
  const authenticated = await requireSession(request(), ['player']);
  assert.equal(requireCsrf(request({ csrf: 'wrong-token' }), authenticated.session).status, 403);
  assert.equal(requireCsrf(request({ csrf: session.csrf }), authenticated.session), null);
});
