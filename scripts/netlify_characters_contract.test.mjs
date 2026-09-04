import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { NetlifyDB } from '@netlify/database-dev';
import pg from 'pg';

let db;
let connectionString;
let readCharacter;
let deleteCharacter;
let createSession;
let closePool;
const users = {};
const sessions = {};
const chars = {};
let campaignId;
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
      ['admin', 'char-admin', 'admin'],
      ['dm', 'char-dm', 'dm'],
      ['dm2', 'char-dm-two', 'dm'],
      ['owner', 'char-owner', 'player'],
      ['member', 'char-member', 'player'],
      ['outsider', 'char-outsider', 'player'],
    ]) {
      const result = await client.query(
        `INSERT INTO users (username, password_hash, role) VALUES ($1, 'hash', $2) RETURNING id`,
        [username, role],
      );
      users[key] = result.rows[0].id;
    }

    const campaign = await client.query(
      `INSERT INTO campaigns (name, dm_id) VALUES ('Character Contract', $1) RETURNING id`,
      [users.dm],
    );
    campaignId = campaign.rows[0].id;
    for (const userId of [users.owner, users.member]) {
      await client.query(
        `INSERT INTO campaign_memberships (campaign_id, user_id, role, approved)
         VALUES ($1, $2, 'player', TRUE)`,
        [campaignId, userId],
      );
    }

    async function addChar(key, ownerId, campaign, isNpc, name) {
      const result = await client.query(
        `INSERT INTO characters (owner_id, campaign_id, is_npc, name, level, max_hp, current_hp)
         VALUES ($1, $2, $3, $4, 3, 20, 20) RETURNING id`,
        [ownerId, campaign, isNpc, name],
      );
      chars[key] = result.rows[0].id;
    }

    await addChar('campaignPc', users.owner, campaignId, false, 'Campaign PC');
    await addChar('campaignNpc', users.dm, campaignId, true, 'Campaign NPC');
    await addChar('privatePc', users.owner, null, false, 'Private PC');
    await addChar('privatePcDelete', users.owner, null, false, 'Private PC Delete');
    await addChar('campaignPcDelete', users.owner, campaignId, false, 'Campaign PC Delete');
    await addChar('campaignNpcDelete', users.dm, campaignId, true, 'Campaign NPC Delete');
    await addChar('unassignedNpcDelete', users.dm, null, true, 'Unassigned NPC Delete');
  } finally {
    await client.end();
  }

  ({ default: readCharacter } = await import('../netlify/functions/characters.mts'));
  ({ default: deleteCharacter } = await import('../netlify/functions/characters-delete.mts'));
  ({ createSession } = await import('../netlify/lib/session-store.mts'));
  ({ __closePoolForTests: closePool } = await import('../netlify/lib/pg.mts'));
  for (const key of Object.keys(users)) sessions[key] = await createSession(users[key]);
});

after(async () => {
  if (closePool) await closePool();
  if (originalDatabaseUrl === undefined) delete process.env.NETLIFY_DB_URL;
  else process.env.NETLIFY_DB_URL = originalDatabaseUrl;
  if (db) await db.stop();
});

function getRequest(role, id) {
  return new Request(`http://localhost/api/characters?id=${id}`, {
    headers: { cookie: `__Host-cf_session=${encodeURIComponent(sessions[role].token)}` },
  });
}

function deleteRequest(role, id, csrf = sessions[role].csrf) {
  return new Request('http://localhost/api/characters/delete', {
    method: 'POST',
    headers: {
      cookie: `__Host-cf_session=${encodeURIComponent(sessions[role].token)}`,
      'x-csrf-token': csrf,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ id }),
  });
}

async function status(role, id) {
  return (await readCharacter(getRequest(role, id))).status;
}

test('character visibility matches owner, campaign, DM, and admin boundaries', async () => {
  assert.equal(await status('owner', chars.campaignPc), 200);
  assert.equal(await status('owner', chars.privatePc), 200);
  assert.equal(await status('member', chars.campaignPc), 200);
  assert.equal(await status('member', chars.campaignNpc), 200);
  assert.equal(await status('member', chars.privatePc), 403);
  assert.equal(await status('dm', chars.campaignPc), 200);
  assert.equal(await status('dm2', chars.campaignPc), 403);
  assert.equal(await status('outsider', chars.campaignPc), 403);
  assert.equal(await status('admin', chars.privatePc), 200);
});

test('character deletion requires CSRF and preserves role ownership rules', async () => {
  const badCsrf = await deleteCharacter(deleteRequest('owner', chars.privatePcDelete, 'wrong'));
  assert.equal(badCsrf.status, 403);

  const memberDenied = await deleteCharacter(deleteRequest('member', chars.campaignPcDelete));
  assert.equal(memberDenied.status, 403);

  const outsiderDmDenied = await deleteCharacter(deleteRequest('dm2', chars.campaignNpcDelete));
  assert.equal(outsiderDmDenied.status, 403);

  const playerDelete = await deleteCharacter(deleteRequest('owner', chars.privatePcDelete));
  assert.equal(playerDelete.status, 200);

  const dmPcDelete = await deleteCharacter(deleteRequest('dm', chars.campaignPcDelete));
  assert.equal(dmPcDelete.status, 200);

  const dmNpcDelete = await deleteCharacter(deleteRequest('dm', chars.campaignNpcDelete));
  assert.equal(dmNpcDelete.status, 200);

  const unassignedNpcDelete = await deleteCharacter(deleteRequest('dm', chars.unassignedNpcDelete));
  assert.equal(unassignedNpcDelete.status, 200);

  for (const id of [chars.privatePcDelete, chars.campaignPcDelete, chars.campaignNpcDelete, chars.unassignedNpcDelete]) {
    const response = await readCharacter(getRequest('admin', id));
    assert.equal(response.status, 404);
  }
});
