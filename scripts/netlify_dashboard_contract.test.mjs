import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { NetlifyDB } from '@netlify/database-dev';
import pg from 'pg';

let db;
let connectionString;
let characters;
let campaignMembers;
let approveMember;
let kickMember;
let createSession;
let closePool;
const users = {};
const sessions = {};
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
      ['admin', 'dash-admin', 'admin'],
      ['dm', 'dash-dm', 'dm'],
      ['dm2', 'dash-dm-two', 'dm'],
      ['owner', 'dash-owner', 'player'],
      ['member', 'dash-member', 'player'],
      ['pending', 'dash-pending', 'player'],
      ['outsider', 'dash-outsider', 'player'],
    ]) {
      const result = await client.query(
        `INSERT INTO users (username, password_hash, role, display_name)
         VALUES ($1, 'hash', $2, $3) RETURNING id`,
        [username, role, username.replace('dash-', '')],
      );
      users[key] = result.rows[0].id;
    }

    const campaign = await client.query(
      `INSERT INTO campaigns (name, dm_id) VALUES ('Dashboard Contract', $1) RETURNING id`,
      [users.dm],
    );
    campaignId = campaign.rows[0].id;

    await client.query(
      `INSERT INTO campaign_memberships (campaign_id, user_id, role, approved)
       VALUES
         ($1, $2, 'dm', TRUE),
         ($1, $3, 'player', TRUE),
         ($1, $4, 'player', TRUE),
         ($1, $5, 'player', FALSE)`,
      [campaignId, users.dm, users.owner, users.member, users.pending],
    );

    for (const [ownerId, inCampaign, isNpc, name] of [
      [users.owner, true, false, 'Campaign Hero'],
      [users.dm, true, true, 'Campaign NPC'],
      [users.owner, false, false, 'Private Hero'],
      [users.dm, false, true, 'Private NPC'],
    ]) {
      await client.query(
        `INSERT INTO characters (owner_id, campaign_id, is_npc, name, level, max_hp, current_hp)
         VALUES ($1, $2, $3, $4, 3, 20, 20)`,
        [ownerId, inCampaign ? campaignId : null, isNpc, name],
      );
    }
  } finally {
    await client.end();
  }

  ({ default: characters } = await import('../netlify/functions/characters.mts'));
  ({ default: campaignMembers } = await import('../netlify/functions/campaigns-members.mts'));
  ({ default: approveMember } = await import('../netlify/functions/campaigns-approve.mts'));
  ({ default: kickMember } = await import('../netlify/functions/campaigns-kick.mts'));
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

function getRequest(role, url) {
  return new Request(url, {
    headers: { cookie: `__Host-cf_session=${encodeURIComponent(sessions[role].token)}` },
  });
}

function postRequest(role, url, body) {
  return new Request(url, {
    method: 'POST',
    headers: {
      cookie: `__Host-cf_session=${encodeURIComponent(sessions[role].token)}`,
      'x-csrf-token': sessions[role].csrf,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function listedNames(role) {
  const response = await characters(getRequest(role, 'http://localhost/api/characters'));
  assert.equal(response.status, 200);
  return new Set((await response.json()).characters.map((character) => character.name));
}

test('character dashboard listing mirrors character view authorization', async () => {
  assert.deepEqual(await listedNames('admin'), new Set(['Campaign Hero', 'Campaign NPC', 'Private Hero', 'Private NPC']));
  assert.deepEqual(await listedNames('dm'), new Set(['Campaign Hero', 'Campaign NPC', 'Private NPC']));
  assert.deepEqual(await listedNames('owner'), new Set(['Campaign Hero', 'Campaign NPC', 'Private Hero']));
  assert.deepEqual(await listedNames('member'), new Set(['Campaign Hero', 'Campaign NPC']));
  assert.deepEqual(await listedNames('pending'), new Set());
  assert.deepEqual(await listedNames('outsider'), new Set());
  assert.deepEqual(await listedNames('dm2'), new Set());
});

test('campaign member roster is visible only to owning DM or admin', async () => {
  const dm = await campaignMembers(getRequest('dm', `http://localhost/api/campaigns/members?campaign_id=${campaignId}`));
  assert.equal(dm.status, 200);
  const members = (await dm.json()).members;
  assert.equal(members.length, 4);
  assert.equal(members.find((member) => member.user_id === users.dm).is_owner, true);
  assert.equal(members.find((member) => member.user_id === users.pending).approved, false);

  const admin = await campaignMembers(getRequest('admin', `http://localhost/api/campaigns/members?campaign_id=${campaignId}`));
  assert.equal(admin.status, 200);

  const otherDm = await campaignMembers(getRequest('dm2', `http://localhost/api/campaigns/members?campaign_id=${campaignId}`));
  assert.equal(otherDm.status, 403);

  const player = await campaignMembers(getRequest('member', `http://localhost/api/campaigns/members?campaign_id=${campaignId}`));
  assert.equal(player.status, 403);
});

test('pending member can be approved and non-owner member can be kicked', async () => {
  const approved = await approveMember(postRequest('dm', 'http://localhost/api/campaigns/approve', {
    campaign_id: campaignId,
    user_id: users.pending,
  }));
  assert.equal(approved.status, 200);

  const kicked = await kickMember(postRequest('dm', 'http://localhost/api/campaigns/kick', {
    campaign_id: campaignId,
    user_id: users.member,
  }));
  assert.equal(kicked.status, 200);

  const roster = await campaignMembers(getRequest('dm', `http://localhost/api/campaigns/members?campaign_id=${campaignId}`));
  const members = (await roster.json()).members;
  assert.equal(members.some((member) => member.user_id === users.member), false);
  assert.equal(members.find((member) => member.user_id === users.pending).approved, true);
});

test('campaign owner membership cannot be kicked', async () => {
  const response = await kickMember(postRequest('admin', 'http://localhost/api/campaigns/kick', {
    campaign_id: campaignId,
    user_id: users.dm,
  }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'owner_membership_required' });

  const roster = await campaignMembers(getRequest('admin', `http://localhost/api/campaigns/members?campaign_id=${campaignId}`));
  assert.equal((await roster.json()).members.some((member) => member.user_id === users.dm), true);
});
