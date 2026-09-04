import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { NetlifyDB } from '@netlify/database-dev';
import pg from 'pg';

let db;
let connectionString;
let campaigns;
let createSession;
let closePool;
const sessions = {};
const users = {};
const originalDatabaseUrl = process.env.NETLIFY_DB_URL;

before(async () => {
  db = new NetlifyDB({ logger: () => {} });
  connectionString = await db.start();
  await db.applyMigrations('./netlify/database/migrations');
  process.env.NETLIFY_DB_URL = connectionString;

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    for (const [name, role] of [['campaign-admin', 'admin'], ['campaign-dm', 'dm'], ['campaign-player', 'player']]) {
      const result = await client.query(
        `INSERT INTO users (username, password_hash, role) VALUES ($1, 'hash', $2) RETURNING id`,
        [name, role],
      );
      users[role] = result.rows[0].id;
    }
  } finally {
    await client.end();
  }

  ({ default: campaigns } = await import('../netlify/functions/campaigns.mts'));
  ({ createSession } = await import('../netlify/lib/session-store.mts'));
  ({ __closePoolForTests: closePool } = await import('../netlify/lib/pg.mts'));
  sessions.admin = await createSession(users.admin);
  sessions.dm = await createSession(users.dm);
  sessions.player = await createSession(users.player);
});

after(async () => {
  if (closePool) await closePool();
  if (originalDatabaseUrl === undefined) delete process.env.NETLIFY_DB_URL;
  else process.env.NETLIFY_DB_URL = originalDatabaseUrl;
  if (db) await db.stop();
});

function requestFor(role, method = 'GET', body, includeCsrf = true) {
  const session = sessions[role];
  const headers = { cookie: `__Host-cf_session=${encodeURIComponent(session.token)}` };
  if (includeCsrf) headers['x-csrf-token'] = session.csrf;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return new Request('http://localhost/api/campaigns', {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function withClient(fn) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try { return await fn(client); }
  finally { await client.end(); }
}

test('player cannot create campaigns and DM mutations require CSRF', async () => {
  const player = await campaigns(requestFor('player', 'POST', { name: 'Blocked Campaign' }));
  assert.equal(player.status, 403);

  const noCsrf = await campaigns(requestFor('dm', 'POST', { name: 'No CSRF Campaign' }, false));
  assert.equal(noCsrf.status, 403);
  assert.deepEqual(await noCsrf.json(), { error: 'csrf_invalid' });
});

test('DM creates a campaign atomically with approved DM membership', async () => {
  const response = await campaigns(requestFor('dm', 'POST', {
    name: 'Contract Campaign',
    description: 'Protected campaign API fixture.',
  }));
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.campaign.dm_id, users.dm);

  await withClient(async (client) => {
    const membership = await client.query(
      `SELECT role, approved FROM campaign_memberships WHERE campaign_id = $1 AND user_id = $2`,
      [body.campaign.id, users.dm],
    );
    assert.equal(membership.rows[0].role, 'dm');
    assert.equal(membership.rows[0].approved, true);
  });
  globalThis.__characterForgeCampaignId = body.campaign.id;
});

test('campaign listing is role-scoped', async () => {
  const dmResponse = await campaigns(requestFor('dm'));
  const dmBody = await dmResponse.json();
  assert.equal(dmBody.campaigns.length, 1);
  assert.equal(dmBody.campaigns[0].id, globalThis.__characterForgeCampaignId);

  const adminResponse = await campaigns(requestFor('admin'));
  const adminBody = await adminResponse.json();
  assert.equal(adminBody.campaigns.length, 1);

  const playerBefore = await campaigns(requestFor('player'));
  assert.equal((await playerBefore.json()).campaigns.length, 0);

  await withClient((client) => client.query(
    `INSERT INTO campaign_memberships (campaign_id, user_id, role, approved)
     VALUES ($1, $2, 'player', TRUE)`,
    [globalThis.__characterForgeCampaignId, users.player],
  ));

  const playerAfter = await campaigns(requestFor('player'));
  const playerBody = await playerAfter.json();
  assert.equal(playerBody.campaigns.length, 1);
  assert.equal(playerBody.campaigns[0].id, globalThis.__characterForgeCampaignId);
});
