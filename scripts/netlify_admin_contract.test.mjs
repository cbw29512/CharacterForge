import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { NetlifyDB } from '@netlify/database-dev';
import pg from 'pg';

let db;
let connectionString;
let overview;
let createUser;
let changeRole;
let resetPassword;
let deleteUser;
let createSession;
let getSession;
let closePool;
const users = {};
const sessions = {};
const originalDatabaseUrl = process.env.NETLIFY_DB_URL;

before(async () => {
  db = new NetlifyDB({ logger: () => {} });
  connectionString = await db.start();
  await db.applyMigrations('./netlify/database/migrations');
  process.env.NETLIFY_DB_URL = connectionString;

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    for (const [key, username, role] of [
      ['admin', 'admin-primary', 'admin'],
      ['admin2', 'admin-secondary', 'admin'],
      ['dm', 'admin-contract-dm', 'dm'],
      ['player', 'admin-contract-player', 'player'],
      ['deleteMe', 'admin-contract-delete', 'player'],
    ]) {
      const result = await client.query(
        `INSERT INTO users (username, password_hash, role, display_name)
         VALUES ($1, 'fixture-hash', $2, $1) RETURNING id`,
        [username, role],
      );
      users[key] = result.rows[0].id;
    }
    await client.query(
      `INSERT INTO campaigns (name, dm_id) VALUES ('Owned Campaign', $1)`,
      [users.dm],
    );
  } finally {
    await client.end();
  }

  ({ default: overview } = await import('../netlify/functions/admin-overview.mts'));
  ({ default: createUser } = await import('../netlify/functions/admin-users-create.mts'));
  ({ default: changeRole } = await import('../netlify/functions/admin-users-role.mts'));
  ({ default: resetPassword } = await import('../netlify/functions/admin-users-password.mts'));
  ({ default: deleteUser } = await import('../netlify/functions/admin-users-delete.mts'));
  ({ createSession, getSession } = await import('../netlify/lib/session-store.mts'));
  ({ __closePoolForTests: closePool } = await import('../netlify/lib/pg.mts'));
  for (const key of Object.keys(users)) sessions[key] = await createSession(users[key]);
});

after(async () => {
  if (closePool) await closePool();
  if (originalDatabaseUrl === undefined) delete process.env.NETLIFY_DB_URL;
  else process.env.NETLIFY_DB_URL = originalDatabaseUrl;
  if (db) await db.stop();
});

function requestFor(key, url, method = 'GET', body, includeCsrf = true) {
  const session = sessions[key];
  const headers = { cookie: `__Host-cf_session=${encodeURIComponent(session.token)}` };
  if (includeCsrf) headers['x-csrf-token'] = session.csrf;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function dbQuery(text, params = []) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try { return await client.query(text, params); }
  finally { await client.end(); }
}

test('admin overview is admin-only and never exposes password/session secrets', async () => {
  const denied = await overview(requestFor('player', 'http://localhost/api/admin/overview'));
  assert.equal(denied.status, 403);

  const response = await overview(requestFor('admin', 'http://localhost/api/admin/overview'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.counts.user_count, 5);
  assert.equal(body.counts.campaign_count, 1);
  assert.equal(Array.isArray(body.users), true);
  assert.equal(JSON.stringify(body).includes('password_hash'), false);
  assert.equal(JSON.stringify(body).includes('token_hash'), false);
  assert.equal(body.campaigns[0].dm_name, 'admin-contract-dm');
});

test('admin creation requires CSRF and enforces case-insensitive usernames', async () => {
  const noCsrf = await createUser(requestFor('admin', 'http://localhost/api/admin/users/create', 'POST', {
    username: 'Created-User', password: 'correct horse battery staple', role: 'player',
  }, false));
  assert.equal(noCsrf.status, 403);

  const created = await createUser(requestFor('admin', 'http://localhost/api/admin/users/create', 'POST', {
    username: 'Created-User', display_name: 'Created User', password: 'correct horse battery staple', role: 'player',
  }));
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.user.username, 'created-user');
  assert.equal(createdBody.user.role, 'player');
  assert.equal('password_hash' in createdBody.user, false);

  const duplicate = await createUser(requestFor('admin', 'http://localhost/api/admin/users/create', 'POST', {
    username: 'CREATED-USER', password: 'another secure password', role: 'player',
  }));
  assert.equal(duplicate.status, 409);
  assert.deepEqual(await duplicate.json(), { error: 'username_unavailable' });
});

test('role changes are immediate and the last admin cannot be demoted', async () => {
  const demoteSecondary = await changeRole(requestFor('admin', 'http://localhost/api/admin/users/role', 'POST', {
    user_id: users.admin2, role: 'dm',
  }));
  assert.equal(demoteSecondary.status, 200);
  assert.equal((await getSession(sessions.admin2.token)).role, 'dm');

  const lastAdmin = await changeRole(requestFor('admin', 'http://localhost/api/admin/users/role', 'POST', {
    user_id: users.admin, role: 'player',
  }));
  assert.equal(lastAdmin.status, 409);
  assert.deepEqual(await lastAdmin.json(), { error: 'last_admin_required' });
  assert.equal((await getSession(sessions.admin.token)).role, 'admin');
});

test('password reset revokes every active target session', async () => {
  const extra = await createSession(users.player);
  const response = await resetPassword(requestFor('admin', 'http://localhost/api/admin/users/password', 'POST', {
    user_id: users.player, password: 'new secure password 123',
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sessions_revoked, true);
  assert.equal(await getSession(sessions.player.token), null);
  assert.equal(await getSession(extra.token), null);
});

test('user deletion protects self, last admin, and campaign owners', async () => {
  const self = await deleteUser(requestFor('admin', 'http://localhost/api/admin/users/delete', 'POST', {
    user_id: users.admin,
  }));
  assert.equal(self.status, 409);
  assert.deepEqual(await self.json(), { error: 'cannot_delete_self' });

  const owner = await deleteUser(requestFor('admin', 'http://localhost/api/admin/users/delete', 'POST', {
    user_id: users.dm,
  }));
  assert.equal(owner.status, 409);
  const ownerBody = await owner.json();
  assert.equal(ownerBody.error, 'user_owns_campaigns');
  assert.equal(ownerBody.campaign_count, 1);

  const deleted = await deleteUser(requestFor('admin', 'http://localhost/api/admin/users/delete', 'POST', {
    user_id: users.deleteMe,
  }));
  assert.equal(deleted.status, 200);
  const check = await dbQuery(`SELECT COUNT(*)::int AS count FROM users WHERE id = $1`, [users.deleteMe]);
  assert.equal(check.rows[0].count, 0);
  assert.equal(await getSession(sessions.deleteMe.token), null);
});
