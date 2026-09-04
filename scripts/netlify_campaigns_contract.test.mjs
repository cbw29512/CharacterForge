import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { NetlifyDB } from '@netlify/database-dev';
import pg from 'pg';

let db;
let connectionString;
let campaigns;
let browseCampaigns;
let joinCampaign;
let approveMember;
let kickMember;
let deleteCampaign;
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
    for (const [key, username, role] of [
      ['admin', 'campaign-admin', 'admin'],
      ['dm', 'campaign-dm', 'dm'],
      ['dm2', 'campaign-dm-two', 'dm'],
      ['player', 'campaign-player', 'player'],
    ]) {
      const result = await client.query(
        `INSERT INTO users (username, password_hash, role) VALUES ($1, 'hash', $2) RETURNING id`,
        [username, role],
      );
      users[key] = result.rows[0].id;
    }
  } finally {
    await client.end();
  }

  ({ default: campaigns } = await import('../netlify/functions/campaigns.mts'));
  ({ default: browseCampaigns } = await import('../netlify/functions/campaigns-browse.mts'));
  ({ default: joinCampaign } = await import('../netlify/functions/campaigns-join.mts'));
  ({ default: approveMember } = await import('../netlify/functions/campaigns-approve.mts'));
  ({ default: kickMember } = await import('../netlify/functions/campaigns-kick.mts'));
  ({ default: deleteCampaign } = await import('../netlify/functions/campaigns-delete.mts'));
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

function requestFor(role, url, method = 'GET', body, includeCsrf = true) {
  const session = sessions[role];
  const headers = { cookie: `__Host-cf_session=${encodeURIComponent(session.token)}` };
  if (includeCsrf) headers['x-csrf-token'] = session.csrf;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return new Request(url, {
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
  const player = await campaigns(requestFor('player', 'http://localhost/api/campaigns', 'POST', { name: 'Blocked Campaign' }));
  assert.equal(player.status, 403);

  const noCsrf = await campaigns(requestFor('dm', 'http://localhost/api/campaigns', 'POST', { name: 'No CSRF Campaign' }, false));
  assert.equal(noCsrf.status, 403);
  assert.deepEqual(await noCsrf.json(), { error: 'csrf_invalid' });
});

test('DM creates a campaign atomically with approved DM membership', async () => {
  const response = await campaigns(requestFor('dm', 'http://localhost/api/campaigns', 'POST', {
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

test('campaign listing and browse are role-scoped', async () => {
  const dmBody = await (await campaigns(requestFor('dm', 'http://localhost/api/campaigns'))).json();
  assert.equal(dmBody.campaigns.length, 1);

  const otherDmBody = await (await campaigns(requestFor('dm2', 'http://localhost/api/campaigns'))).json();
  assert.equal(otherDmBody.campaigns.length, 0);

  const adminBody = await (await campaigns(requestFor('admin', 'http://localhost/api/campaigns'))).json();
  assert.equal(adminBody.campaigns.length, 1);

  const playerBody = await (await campaigns(requestFor('player', 'http://localhost/api/campaigns'))).json();
  assert.equal(playerBody.campaigns.length, 0);

  const available = await (await browseCampaigns(requestFor('player', 'http://localhost/api/campaigns/browse'))).json();
  assert.equal(available.campaigns.length, 1);
  assert.equal(available.campaigns[0].id, globalThis.__characterForgeCampaignId);

  const dmAvailable = await (await browseCampaigns(requestFor('dm', 'http://localhost/api/campaigns/browse'))).json();
  assert.equal(dmAvailable.campaigns.length, 0);
});

test('join creates one pending membership and removes campaign from browse', async () => {
  const noCsrf = await joinCampaign(requestFor('player', 'http://localhost/api/campaigns/join', 'POST', {
    campaign_id: globalThis.__characterForgeCampaignId,
  }, false));
  assert.equal(noCsrf.status, 403);

  const joined = await joinCampaign(requestFor('player', 'http://localhost/api/campaigns/join', 'POST', {
    campaign_id: globalThis.__characterForgeCampaignId,
  }));
  assert.equal(joined.status, 201);
  assert.equal((await joined.json()).membership.approved, false);

  const duplicate = await joinCampaign(requestFor('player', 'http://localhost/api/campaigns/join', 'POST', {
    campaign_id: globalThis.__characterForgeCampaignId,
  }));
  assert.equal(duplicate.status, 409);

  const available = await (await browseCampaigns(requestFor('player', 'http://localhost/api/campaigns/browse'))).json();
  assert.equal(available.campaigns.length, 0);

  const playerDashboard = await (await campaigns(requestFor('player', 'http://localhost/api/campaigns'))).json();
  assert.equal(playerDashboard.campaigns.length, 0);
});

test('only owning DM or admin can approve and kick memberships', async () => {
  const outsider = await approveMember(requestFor('dm2', 'http://localhost/api/campaigns/approve', 'POST', {
    campaign_id: globalThis.__characterForgeCampaignId,
    user_id: users.player,
  }));
  assert.equal(outsider.status, 403);

  const approved = await approveMember(requestFor('dm', 'http://localhost/api/campaigns/approve', 'POST', {
    campaign_id: globalThis.__characterForgeCampaignId,
    user_id: users.player,
  }));
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).membership.approved, true);

  const playerDashboard = await (await campaigns(requestFor('player', 'http://localhost/api/campaigns'))).json();
  assert.equal(playerDashboard.campaigns.length, 1);

  const outsiderKick = await kickMember(requestFor('dm2', 'http://localhost/api/campaigns/kick', 'POST', {
    campaign_id: globalThis.__characterForgeCampaignId,
    user_id: users.player,
  }));
  assert.equal(outsiderKick.status, 403);

  const kicked = await kickMember(requestFor('dm', 'http://localhost/api/campaigns/kick', 'POST', {
    campaign_id: globalThis.__characterForgeCampaignId,
    user_id: users.player,
  }));
  assert.equal(kicked.status, 200);

  const afterKick = await (await campaigns(requestFor('player', 'http://localhost/api/campaigns'))).json();
  assert.equal(afterKick.campaigns.length, 0);
});

test('DM cannot approve another DM, while admin can override', async () => {
  const joined = await joinCampaign(requestFor('dm2', 'http://localhost/api/campaigns/join', 'POST', {
    campaign_id: globalThis.__characterForgeCampaignId,
  }));
  assert.equal(joined.status, 201);

  const dmDenied = await approveMember(requestFor('dm', 'http://localhost/api/campaigns/approve', 'POST', {
    campaign_id: globalThis.__characterForgeCampaignId,
    user_id: users.dm2,
  }));
  assert.equal(dmDenied.status, 403);

  const adminApproved = await approveMember(requestFor('admin', 'http://localhost/api/campaigns/approve', 'POST', {
    campaign_id: globalThis.__characterForgeCampaignId,
    user_id: users.dm2,
  }));
  assert.equal(adminApproved.status, 200);
});

test('campaign deletion is ownership-protected and cascades memberships', async () => {
  const outsider = await deleteCampaign(requestFor('dm2', 'http://localhost/api/campaigns/delete', 'POST', {
    campaign_id: globalThis.__characterForgeCampaignId,
  }));
  assert.equal(outsider.status, 403);

  const deleted = await deleteCampaign(requestFor('dm', 'http://localhost/api/campaigns/delete', 'POST', {
    campaign_id: globalThis.__characterForgeCampaignId,
  }));
  assert.equal(deleted.status, 200);

  await withClient(async (client) => {
    const campaign = await client.query(`SELECT COUNT(*)::int AS count FROM campaigns WHERE id = $1`, [globalThis.__characterForgeCampaignId]);
    const memberships = await client.query(`SELECT COUNT(*)::int AS count FROM campaign_memberships WHERE campaign_id = $1`, [globalThis.__characterForgeCampaignId]);
    assert.equal(campaign.rows[0].count, 0);
    assert.equal(memberships.rows[0].count, 0);
  });
});
