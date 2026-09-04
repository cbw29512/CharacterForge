import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { NetlifyDB } from '@netlify/database-dev';
import pg from 'pg';

let db;
let connectionString;
let viewCampaign;
let createSession;
let closePool;
const users = {};
const sessions = {};
let campaignId;
let playerCharacterId;
const originalDatabaseUrl = process.env.NETLIFY_DB_URL;

before(async () => {
  db = new NetlifyDB({ logger: () => {} });
  connectionString = await db.start();
  await db.applyMigrations('./netlify/database/migrations');
  process.env.NETLIFY_DB_URL = connectionString;

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    for (const [name, role] of [
      ['view-admin', 'admin'], ['view-dm', 'dm'], ['view-player', 'player'],
      ['view-pending', 'player'], ['view-outsider', 'player'],
    ]) {
      const result = await client.query(
        `INSERT INTO users (username, password_hash, role, display_name)
         VALUES ($1, 'hash', $2, $3) RETURNING id`,
        [name, role, name],
      );
      users[name] = result.rows[0].id;
    }
    const campaign = await client.query(
      `INSERT INTO campaigns (name, description, dm_id)
       VALUES ('View Contract Campaign', 'Campaign detail fixture.', $1) RETURNING id`,
      [users['view-dm']],
    );
    campaignId = campaign.rows[0].id;
    await client.query(
      `INSERT INTO campaign_memberships (campaign_id, user_id, role, approved) VALUES
       ($1, $2, 'dm', TRUE),
       ($1, $3, 'player', TRUE),
       ($1, $4, 'player', FALSE)`,
      [campaignId, users['view-dm'], users['view-player'], users['view-pending']],
    );
    const pc = await client.query(
      `INSERT INTO characters (owner_id, campaign_id, is_npc, name, level, char_class, race, max_hp, current_hp, armor_class, build_complete)
       VALUES ($1, $2, FALSE, 'Player Hero', 3, 'Fighter', 'Human', 28, 28, 16, TRUE) RETURNING id`,
      [users['view-player'], campaignId],
    );
    playerCharacterId = pc.rows[0].id;
    await client.query(
      `INSERT INTO characters (owner_id, campaign_id, is_npc, name, level, char_class, race, max_hp, current_hp, armor_class, build_complete)
       VALUES ($1, $2, TRUE, 'Campaign Guide', 2, 'Rogue', 'Human', 15, 15, 13, TRUE)`,
      [users['view-dm'], campaignId],
    );
  } finally {
    await client.end();
  }

  ({ default: viewCampaign } = await import('../netlify/functions/campaigns-view.mts'));
  ({ createSession } = await import('../netlify/lib/session-store.mts'));
  ({ __closePoolForTests: closePool } = await import('../netlify/lib/pg.mts'));
  for (const name of Object.keys(users)) sessions[name] = await createSession(users[name]);
});

after(async () => {
  if (closePool) await closePool();
  if (originalDatabaseUrl === undefined) delete process.env.NETLIFY_DB_URL;
  else process.env.NETLIFY_DB_URL = originalDatabaseUrl;
  if (db) await db.stop();
});

function requestFor(name, id = campaignId) {
  const session = sessions[name];
  return new Request(`http://localhost/api/campaigns/view?id=${id}`, {
    headers: { cookie: `__Host-cf_session=${encodeURIComponent(session.token)}` },
  });
}

test('approved player sees campaign characters without manager-only membership data', async () => {
  const response = await viewCampaign(requestFor('view-player'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.is_dm, false);
  assert.equal(body.pc_characters.length, 1);
  assert.equal(body.npc_characters.length, 1);
  assert.equal(body.my_character.id, playerCharacterId);
  assert.deepEqual(body.members, []);
  assert.deepEqual(body.pending, []);
});

test('owning DM sees approved and pending membership identities with owner marker', async () => {
  const response = await viewCampaign(requestFor('view-dm'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.is_dm, true);
  const owner = body.members.find((row) => row.username === 'view-dm');
  assert.ok(owner);
  assert.equal(owner.is_owner, true);
  const player = body.members.find((row) => row.username === 'view-player');
  assert.ok(player);
  assert.equal(player.is_owner, false);
  assert.equal(body.pending.length, 1);
  assert.equal(body.pending[0].username, 'view-pending');
  assert.equal(body.pending[0].is_owner, false);
});

test('admin receives manager view and outsider is forbidden', async () => {
  const admin = await viewCampaign(requestFor('view-admin'));
  assert.equal(admin.status, 200);
  const adminBody = await admin.json();
  assert.equal(adminBody.is_dm, true);
  assert.equal(adminBody.members.find((row) => row.username === 'view-dm').is_owner, true);

  const outsider = await viewCampaign(requestFor('view-outsider'));
  assert.equal(outsider.status, 403);
});

test('invalid and missing campaign ids fail closed', async () => {
  const invalid = await viewCampaign(requestFor('view-player', 0));
  assert.equal(invalid.status, 400);
  const missing = await viewCampaign(requestFor('view-admin', 999999));
  assert.equal(missing.status, 404);
});
