import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { NetlifyDB } from '@netlify/database-dev';
import pg from 'pg';

let db;
let connectionString;
let kickMember;
let createSession;
let closePool;
let campaignId;
let dmId;
let adminSession;
const originalDatabaseUrl = process.env.NETLIFY_DB_URL;

before(async () => {
  db = new NetlifyDB({ logger: () => {} });
  connectionString = await db.start();
  await db.applyMigrations('./netlify/database/migrations');
  process.env.NETLIFY_DB_URL = connectionString;

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const admin = await client.query(
      `INSERT INTO users (username, password_hash, role) VALUES ('owner-contract-admin', 'hash', 'admin') RETURNING id`,
    );
    const dm = await client.query(
      `INSERT INTO users (username, password_hash, role) VALUES ('owner-contract-dm', 'hash', 'dm') RETURNING id`,
    );
    dmId = dm.rows[0].id;
    const campaign = await client.query(
      `INSERT INTO campaigns (name, dm_id) VALUES ('Owner Contract Campaign', $1) RETURNING id`,
      [dmId],
    );
    campaignId = campaign.rows[0].id;
    await client.query(
      `INSERT INTO campaign_memberships (campaign_id, user_id, role, approved)
       VALUES ($1, $2, 'dm', TRUE)`,
      [campaignId, dmId],
    );

    ({ default: kickMember } = await import('../netlify/functions/campaigns-kick.mts'));
    ({ createSession } = await import('../netlify/lib/session-store.mts'));
    ({ __closePoolForTests: closePool } = await import('../netlify/lib/pg.mts'));
    adminSession = await createSession(admin.rows[0].id);
  } finally {
    await client.end();
  }
});

after(async () => {
  if (closePool) await closePool();
  if (originalDatabaseUrl === undefined) delete process.env.NETLIFY_DB_URL;
  else process.env.NETLIFY_DB_URL = originalDatabaseUrl;
  if (db) await db.stop();
});

test('campaign owner membership cannot be removed through kick API', async () => {
  const request = new Request('http://localhost/api/campaigns/kick', {
    method: 'POST',
    headers: {
      cookie: `__Host-cf_session=${encodeURIComponent(adminSession.token)}`,
      'x-csrf-token': adminSession.csrf,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ campaign_id: campaignId, user_id: dmId }),
  });

  const response = await kickMember(request);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'owner_membership_required' });

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const membership = await client.query(
      `SELECT role, approved FROM campaign_memberships WHERE campaign_id = $1 AND user_id = $2`,
      [campaignId, dmId],
    );
    assert.equal(membership.rowCount, 1);
    assert.equal(membership.rows[0].role, 'dm');
    assert.equal(membership.rows[0].approved, true);
  } finally {
    await client.end();
  }
});
