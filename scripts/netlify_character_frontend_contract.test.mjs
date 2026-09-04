import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { NetlifyDB } from '@netlify/database-dev';
import pg from 'pg';

let db;
let connectionString;
let readCharacter;
let readSrd;
let createSession;
let closePool;
let campaignId;
let characterId;
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
    for (const [key, role] of [['admin', 'admin'], ['dm', 'dm'], ['owner', 'player'], ['member', 'player']]) {
      const result = await client.query(
        `INSERT INTO users (username, password_hash, role) VALUES ($1, 'hash', $2) RETURNING id`,
        [`frontend-${key}`, role],
      );
      users[key] = result.rows[0].id;
    }
    const campaign = await client.query(
      `INSERT INTO campaigns (name, dm_id) VALUES ('Frontend Character Contract', $1) RETURNING id`,
      [users.dm],
    );
    campaignId = campaign.rows[0].id;
    for (const key of ['owner', 'member']) {
      await client.query(
        `INSERT INTO campaign_memberships (campaign_id, user_id, role, approved)
         VALUES ($1, $2, 'player', TRUE)`,
        [campaignId, users[key]],
      );
    }
    const character = await client.query(
      `INSERT INTO characters (
         owner_id, campaign_id, is_npc, name, level, char_class, race,
         background, alignment, max_hp, current_hp, armor_class, build_complete
       ) VALUES ($1, $2, FALSE, 'Frontend Fighter', 3, 'Fighter', 'Human',
                 'Soldier', 'Neutral Good', 28, 28, 16, TRUE)
       RETURNING id`,
      [users.owner, campaignId],
    );
    characterId = character.rows[0].id;
  } finally {
    await client.end();
  }

  ({ default: readCharacter } = await import('../netlify/functions/characters.mts'));
  ({ default: readSrd } = await import('../netlify/functions/srd.mts'));
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

function requestFor(key, path) {
  return new Request(`http://localhost${path}`, {
    headers: { cookie: `__Host-cf_session=${encodeURIComponent(sessions[key].token)}` },
  });
}

test('canonical SRD endpoint exposes builder choices from shared catalog', async () => {
  const response = await readSrd(requestFor('owner', '/api/srd'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.races.some((row) => row.name === 'Human'), true);
  assert.equal(body.classes.some((row) => row.name === 'Fighter'), true);
  assert.equal(body.backgrounds.some((row) => row.name === 'Soldier'), true);
  assert.equal(body.alignments.includes('True Neutral'), true);
});

test('character read returns server-authorized delete capability', async () => {
  const expected = { owner: true, member: false, dm: true, admin: true };
  for (const [key, canDelete] of Object.entries(expected)) {
    const response = await readCharacter(requestFor(key, `/api/characters?id=${characterId}`));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.character.id, characterId);
    assert.equal(body.can_delete, canDelete, key);
  }
});
