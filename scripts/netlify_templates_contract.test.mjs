import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { NetlifyDB } from '@netlify/database-dev';
import pg from 'pg';

let db;
let connectionString;
let listTemplates;
let saveTemplate;
let useTemplate;
let deleteTemplate;
let createSession;
let closePool;
const users = {};
const sessions = {};
const chars = {};
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
      ['admin', 'template-admin', 'admin'],
      ['dm', 'template-dm', 'dm'],
      ['dm2', 'template-dm-two', 'dm'],
      ['player', 'template-player', 'player'],
    ]) {
      const result = await client.query(
        `INSERT INTO users (username, password_hash, role) VALUES ($1, 'hash', $2) RETURNING id`,
        [username, role],
      );
      users[key] = result.rows[0].id;
    }
    const campaign = await client.query(
      `INSERT INTO campaigns (name, dm_id) VALUES ('Template Campaign', $1) RETURNING id`,
      [users.dm],
    );
    const campaignId = campaign.rows[0].id;

    async function addChar(key, ownerId, isNpc, name) {
      const result = await client.query(
        `INSERT INTO characters (
           owner_id, campaign_id, is_npc, name, level, char_class, race, background,
           alignment, strength, dexterity, constitution, intelligence, wisdom, charisma,
           max_hp, current_hp, traits, notes
         ) VALUES ($1, $2, $3, $4, 3, 'Fighter', 'Human', 'Soldier',
                   'Neutral Good', 16, 14, 14, 10, 12, 8, 28, 28,
                   '{"ideal":"Duty"}'::jsonb, 'Template fixture')
         RETURNING id`,
        [ownerId, campaignId, isNpc, name],
      );
      chars[key] = result.rows[0].id;
    }
    await addChar('npc', users.dm, true, 'DM NPC');
    await addChar('pc', users.player, false, 'Player PC');
  } finally {
    await client.end();
  }

  ({ default: listTemplates } = await import('../netlify/functions/templates.mts'));
  ({ default: saveTemplate } = await import('../netlify/functions/templates-save.mts'));
  ({ default: useTemplate } = await import('../netlify/functions/templates-use.mts'));
  ({ default: deleteTemplate } = await import('../netlify/functions/templates-delete.mts'));
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

function requestFor(role, url, method = 'GET', body, csrf = sessions[role].csrf) {
  const headers = { cookie: `__Host-cf_session=${encodeURIComponent(sessions[role].token)}` };
  if (method !== 'GET') headers['x-csrf-token'] = csrf;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('unrelated DM cannot save another DMs NPC as a template', async () => {
  const response = await saveTemplate(requestFor('dm2', 'http://localhost/api/templates/save', 'POST', {
    character_id: chars.npc,
    name: 'Stolen NPC',
  }));
  assert.equal(response.status, 403);
});

test('save requires CSRF and permits owner, campaign DM, and admin', async () => {
  const noCsrf = await saveTemplate(requestFor('player', 'http://localhost/api/templates/save', 'POST', {
    character_id: chars.pc,
    name: 'No CSRF',
  }, 'wrong'));
  assert.equal(noCsrf.status, 403);

  const playerSaved = await saveTemplate(requestFor('player', 'http://localhost/api/templates/save', 'POST', {
    character_id: chars.pc,
    name: 'Player Fighter',
    description: 'Reusable player build',
  }));
  assert.equal(playerSaved.status, 201);
  const playerTemplate = (await playerSaved.json()).template;
  assert.equal(playerTemplate.owner_id, users.player);
  assert.equal(playerTemplate.is_npc_template, false);
  assert.deepEqual(playerTemplate.traits, { ideal: 'Duty' });
  globalThis.__playerTemplateId = playerTemplate.id;

  const dmSaved = await saveTemplate(requestFor('dm', 'http://localhost/api/templates/save', 'POST', {
    character_id: chars.npc,
    name: 'Owned NPC Template',
  }));
  assert.equal(dmSaved.status, 201);
  const dmTemplate = (await dmSaved.json()).template;
  assert.equal(dmTemplate.owner_id, users.dm);
  assert.equal(dmTemplate.is_npc_template, true);

  const adminSaved = await saveTemplate(requestFor('admin', 'http://localhost/api/templates/save', 'POST', {
    character_id: chars.npc,
    name: 'Admin NPC Copy',
  }));
  assert.equal(adminSaved.status, 201);
  assert.equal((await adminSaved.json()).template.owner_id, users.admin);
});

test('duplicate names are rejected per owner', async () => {
  const duplicate = await saveTemplate(requestFor('player', 'http://localhost/api/templates/save', 'POST', {
    character_id: chars.pc,
    name: 'Player Fighter',
  }));
  assert.equal(duplicate.status, 409);
  assert.deepEqual(await duplicate.json(), { error: 'template_name_exists' });
});

test('template listing is isolated by owner and PC/NPC type', async () => {
  const playerPc = await listTemplates(requestFor('player', 'http://localhost/api/templates'));
  const playerBody = await playerPc.json();
  assert.equal(playerBody.templates.length, 1);
  assert.equal(playerBody.templates[0].name, 'Player Fighter');

  const playerNpc = await listTemplates(requestFor('player', 'http://localhost/api/templates?npc=true'));
  assert.equal((await playerNpc.json()).templates.length, 0);

  const dmNpc = await listTemplates(requestFor('dm', 'http://localhost/api/templates?npc=true'));
  assert.equal((await dmNpc.json()).templates.length, 1);
});

test('use increments only an owned/admin-authorized template', async () => {
  const outsider = await useTemplate(requestFor('dm2', 'http://localhost/api/templates/use', 'POST', {
    template_id: globalThis.__playerTemplateId,
  }));
  assert.equal(outsider.status, 403);

  const used = await useTemplate(requestFor('player', 'http://localhost/api/templates/use', 'POST', {
    template_id: globalThis.__playerTemplateId,
  }));
  assert.equal(used.status, 200);
  assert.equal((await used.json()).template.times_used, 1);

  const adminUse = await useTemplate(requestFor('admin', 'http://localhost/api/templates/use', 'POST', {
    template_id: globalThis.__playerTemplateId,
  }));
  assert.equal(adminUse.status, 200);
  assert.equal((await adminUse.json()).template.times_used, 2);
});

test('delete is owner/admin-only and CSRF-protected', async () => {
  const outsider = await deleteTemplate(requestFor('dm2', 'http://localhost/api/templates/delete', 'POST', {
    template_id: globalThis.__playerTemplateId,
  }));
  assert.equal(outsider.status, 403);

  const badCsrf = await deleteTemplate(requestFor('player', 'http://localhost/api/templates/delete', 'POST', {
    template_id: globalThis.__playerTemplateId,
  }, 'wrong'));
  assert.equal(badCsrf.status, 403);

  const deleted = await deleteTemplate(requestFor('player', 'http://localhost/api/templates/delete', 'POST', {
    template_id: globalThis.__playerTemplateId,
  }));
  assert.equal(deleted.status, 200);

  const list = await listTemplates(requestFor('player', 'http://localhost/api/templates'));
  assert.equal((await list.json()).templates.length, 0);
});
