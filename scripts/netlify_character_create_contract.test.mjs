import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { NetlifyDB } from '@netlify/database-dev';
import pg from 'pg';

let db;
let connectionString;
let createCharacter;
let createSession;
let closePool;
const users = {};
const sessions = {};
const campaigns = {};
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
      ['admin', 'create-admin', 'admin'],
      ['dm', 'create-dm', 'dm'],
      ['dm2', 'create-dm-two', 'dm'],
      ['player', 'create-player', 'player'],
      ['member', 'create-member', 'player'],
    ]) {
      const result = await client.query(
        `INSERT INTO users (username, password_hash, role) VALUES ($1, 'hash', $2) RETURNING id`,
        [username, role],
      );
      users[key] = result.rows[0].id;
    }
    const owned = await client.query(`INSERT INTO campaigns (name, dm_id) VALUES ('Owned', $1) RETURNING id`, [users.dm]);
    const other = await client.query(`INSERT INTO campaigns (name, dm_id) VALUES ('Other', $1) RETURNING id`, [users.dm2]);
    campaigns.owned = owned.rows[0].id;
    campaigns.other = other.rows[0].id;
    await client.query(
      `INSERT INTO campaign_memberships (campaign_id, user_id, role, approved)
       VALUES ($1, $2, 'player', TRUE)`,
      [campaigns.owned, users.member],
    );
  } finally {
    await client.end();
  }

  ({ default: createCharacter } = await import('../netlify/functions/characters-create.mts'));
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

function requestFor(role, body, csrf = sessions[role].csrf) {
  return new Request('http://localhost/api/characters/create', {
    method: 'POST',
    headers: {
      cookie: `__Host-cf_session=${encodeURIComponent(sessions[role].token)}`,
      'x-csrf-token': csrf,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

const fighter = {
  name: 'Contract Fighter',
  race: 'Human',
  char_class: 'Fighter',
  background: 'Soldier',
  alignment: 'Neutral Good',
  level: 3,
  strength: 16,
  dexterity: 14,
  constitution: 14,
  intelligence: 10,
  wisdom: 12,
  charisma: 8,
};

test('creation requires CSRF and only DM/admin can create NPCs', async () => {
  assert.equal((await createCharacter(requestFor('player', fighter, 'wrong'))).status, 403);
  assert.equal((await createCharacter(requestFor('player', { ...fighter, is_npc: true }))).status, 403);
});

test('campaign creation permission prevents campaign id injection', async () => {
  const outsider = await createCharacter(requestFor('player', { ...fighter, campaign_id: campaigns.owned }));
  assert.equal(outsider.status, 403);

  const member = await createCharacter(requestFor('member', { ...fighter, name: 'Member PC', campaign_id: campaigns.owned }));
  assert.equal(member.status, 201);
  assert.equal((await member.json()).character.owner_id, users.member);

  const dmNpc = await createCharacter(requestFor('dm', { ...fighter, name: 'Owned NPC', is_npc: true, campaign_id: campaigns.owned }));
  assert.equal(dmNpc.status, 201);
  const npcBody = await dmNpc.json();
  assert.equal(npcBody.character.owner_id, users.dm);
  assert.equal(npcBody.character.is_npc, true);

  const wrongDm = await createCharacter(requestFor('dm2', { ...fighter, is_npc: true, campaign_id: campaigns.owned }));
  assert.equal(wrongDm.status, 403);
});

test('SRD choices are validated instead of silently falling back', async () => {
  for (const change of [
    { race: 'Space Elf' },
    { char_class: 'Laser Knight' },
    { background: 'Influencer' },
    { alignment: 'Mostly Fine' },
  ]) {
    const response = await createCharacter(requestFor('player', { ...fighter, ...change }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'invalid_srd_choice' });
  }
});

test('Fighter 3 build math and derived SRD fields match Flask behavior', async () => {
  const response = await createCharacter(requestFor('player', fighter));
  assert.equal(response.status, 201);
  const character = (await response.json()).character;
  assert.equal(character.owner_id, users.player);
  assert.equal(character.max_hp, 28);
  assert.equal(character.current_hp, 28);
  assert.equal(character.armor_class, 12);
  assert.equal(character.proficiency_bonus, 2);
  assert.equal(character.hit_dice, '3d10');
  assert.deepEqual(character.skills, { Athletics: true, Intimidation: true });
  assert.deepEqual(character.saving_throws, { Strength: true, Constitution: true });
  assert.deepEqual(character.equipment, ['Insignia of rank', 'Trophy from fallen enemy', 'Deck of cards', 'Common clothes', '10 gp pouch']);
  assert.deepEqual(character.features, ['Fighting Style', 'Second Wind', 'Action Surge (one use)']);
});

test('numeric values clamp safely and explicit overrides respect DB bounds', async () => {
  const response = await createCharacter(requestFor('admin', {
    ...fighter,
    name: '   ',
    level: 99,
    strength: -50,
    dexterity: 'not-a-number',
    constitution: 99,
    hp_override: -10,
    armor_class_override: -4,
    speed: -30,
  }));
  assert.equal(response.status, 201);
  const character = (await response.json()).character;
  assert.equal(character.name, '(unnamed)');
  assert.equal(character.level, 30);
  assert.equal(character.max_hp, 1);
  assert.equal(character.armor_class, 0);
  assert.equal(character.speed, 0);
  assert.equal(character.proficiency_bonus, 6);
  assert.equal(character.hit_dice, '30d10');
});
