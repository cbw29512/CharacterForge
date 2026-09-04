import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { NetlifyDB } from '@netlify/database-dev';
import pg from 'pg';

let db;
let connectionString;

before(async () => {
  db = new NetlifyDB({ logger: () => {} });
  connectionString = await db.start();
  await db.applyMigrations('./netlify/database/migrations');
});

after(async () => {
  if (db) await db.stop();
});

async function withClient(fn) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

test('core migration creates the expected tables', async () => {
  await withClient(async (client) => {
    const { rows } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    const names = new Set(rows.map((row) => row.table_name));
    for (const table of [
      'users',
      'campaigns',
      'campaign_memberships',
      'character_templates',
      'characters',
    ]) {
      assert.equal(names.has(table), true, `missing table: ${table}`);
    }
  });
});

test('username uniqueness is case-insensitive', async () => {
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)`,
      ['CaseUser', 'hash-one', 'player'],
    );
    await assert.rejects(
      client.query(
        `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)`,
        ['caseuser', 'hash-two', 'player'],
      ),
      /duplicate key|unique/i,
    );
  });
});

test('invalid roles are rejected by Postgres', async () => {
  await withClient(async (client) => {
    await assert.rejects(
      client.query(
        `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)`,
        ['bad-role-user', 'hash', 'superadmin'],
      ),
      /check constraint/i,
    );
  });
});

test('campaign membership is unique per user and campaign', async () => {
  await withClient(async (client) => {
    const dm = await client.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'dm') RETURNING id`,
      ['schema-dm', 'hash'],
    );
    const player = await client.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'player') RETURNING id`,
      ['schema-player', 'hash'],
    );
    const campaign = await client.query(
      `INSERT INTO campaigns (name, dm_id) VALUES ($1, $2) RETURNING id`,
      ['Schema Test Campaign', dm.rows[0].id],
    );
    const values = [campaign.rows[0].id, player.rows[0].id];
    await client.query(
      `INSERT INTO campaign_memberships (campaign_id, user_id, role, approved)
       VALUES ($1, $2, 'player', TRUE)`,
      values,
    );
    await assert.rejects(
      client.query(
        `INSERT INTO campaign_memberships (campaign_id, user_id, role, approved)
         VALUES ($1, $2, 'player', TRUE)`,
        values,
      ),
      /duplicate key|unique/i,
    );
  });
});

test('structured character fields round-trip as jsonb', async () => {
  await withClient(async (client) => {
    const owner = await client.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'player') RETURNING id`,
      ['json-owner', 'hash'],
    );
    const { rows } = await client.query(
      `INSERT INTO characters (
         owner_id, name, level, skills, equipment, traits, features
       ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb)
       RETURNING skills, equipment, traits, features`,
      [
        owner.rows[0].id,
        'Schema Fighter',
        3,
        JSON.stringify({ Athletics: true }),
        JSON.stringify(['Longsword', 'Shield']),
        JSON.stringify({ ideal: 'Duty' }),
        JSON.stringify(['Second Wind']),
      ],
    );
    assert.deepEqual(rows[0].skills, { Athletics: true });
    assert.deepEqual(rows[0].equipment, ['Longsword', 'Shield']);
    assert.deepEqual(rows[0].traits, { ideal: 'Duty' });
    assert.deepEqual(rows[0].features, ['Second Wind']);
  });
});

test('character updated_at advances automatically on update', async () => {
  await withClient(async (client) => {
    const owner = await client.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'player') RETURNING id`,
      ['timestamp-owner', 'hash'],
    );
    const created = await client.query(
      `INSERT INTO characters (owner_id, name) VALUES ($1, $2) RETURNING id, updated_at`,
      [owner.rows[0].id, 'Timestamp Fighter'],
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    const updated = await client.query(
      `UPDATE characters SET notes = $1 WHERE id = $2 RETURNING updated_at`,
      ['changed', created.rows[0].id],
    );
    assert.ok(
      new Date(updated.rows[0].updated_at).getTime() > new Date(created.rows[0].updated_at).getTime(),
      'updated_at should advance without application-side timestamp code',
    );
  });
});
