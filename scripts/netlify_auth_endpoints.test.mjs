import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { NetlifyDB } from '@netlify/database-dev';
import pg from 'pg';

let db;
let connectionString;
let setup;
let login;
let me;
let logout;
let closePool;
const originalDatabaseUrl = process.env.NETLIFY_DB_URL;
const adminPassword = 'CharacterForge-Admin-Contract-123!';

before(async () => {
  db = new NetlifyDB({ logger: () => {} });
  connectionString = await db.start();
  await db.applyMigrations('./netlify/database/migrations');
  process.env.NETLIFY_DB_URL = connectionString;

  ({ default: setup } = await import('../netlify/functions/auth-setup.mts'));
  ({ default: login } = await import('../netlify/functions/auth-login.mts'));
  ({ default: me } = await import('../netlify/functions/auth-me.mts'));
  ({ default: logout } = await import('../netlify/functions/auth-logout.mts'));
  ({ __closePoolForTests: closePool } = await import('../netlify/lib/pg.mts'));
});

after(async () => {
  if (closePool) await closePool();
  if (originalDatabaseUrl === undefined) delete process.env.NETLIFY_DB_URL;
  else process.env.NETLIFY_DB_URL = originalDatabaseUrl;
  if (db) await db.stop();
});

function jsonRequest(url, method, body, headers = {}) {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function setCookies(response) {
  if (typeof response.headers.getSetCookie === 'function') return response.headers.getSetCookie();
  const value = response.headers.get('set-cookie');
  return value ? [value] : [];
}

function cookieValue(cookieHeaders, name) {
  for (const header of cookieHeaders) {
    const match = header.match(new RegExp(`(?:^|,\\s*)${name}=([^;]+)`));
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

async function currentAdmin() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query(`SELECT username FROM users WHERE role = 'admin'`);
    return rows;
  } finally {
    await client.end();
  }
}

test('first-admin bootstrap is transaction-safe under concurrent requests', async () => {
  const initial = await setup(new Request('http://localhost/api/auth/setup'));
  assert.equal(initial.status, 200);
  assert.deepEqual(await initial.json(), { setup_required: true });

  const payloadA = { username: 'bootstrap-a', password: adminPassword, confirm: adminPassword, display_name: 'Bootstrap A' };
  const payloadB = { username: 'bootstrap-b', password: adminPassword, confirm: adminPassword, display_name: 'Bootstrap B' };
  const [first, second] = await Promise.all([
    setup(jsonRequest('http://localhost/api/auth/setup', 'POST', payloadA)),
    setup(jsonRequest('http://localhost/api/auth/setup', 'POST', payloadB)),
  ]);

  assert.deepEqual([first.status, second.status].sort(), [201, 409]);
  const admins = await currentAdmin();
  assert.equal(admins.length, 1);
  assert.ok(['bootstrap-a', 'bootstrap-b'].includes(admins[0].username));

  const afterSetup = await setup(new Request('http://localhost/api/auth/setup'));
  assert.deepEqual(await afterSetup.json(), { setup_required: false });
});

test('login creates secure opaque cookies and session lookup returns only user identity', async () => {
  const [admin] = await currentAdmin();
  const bad = await login(jsonRequest('http://localhost/api/auth/login', 'POST', {
    username: admin.username,
    password: 'definitely-wrong',
  }));
  assert.equal(bad.status, 401);
  assert.deepEqual(await bad.json(), { error: 'invalid_credentials' });

  const mismatch = await login(jsonRequest('http://localhost/api/auth/login', 'POST', {
    username: admin.username,
    password: adminPassword,
    role: 'player',
  }));
  assert.equal(mismatch.status, 401);

  const good = await login(jsonRequest('http://localhost/api/auth/login', 'POST', {
    username: admin.username,
    password: adminPassword,
    role: 'admin',
  }));
  assert.equal(good.status, 200);
  const body = await good.json();
  assert.equal(body.ok, true);
  assert.equal(body.user.role, 'admin');
  assert.equal('token' in body, false);
  assert.equal('csrf' in body, false);

  const cookies = setCookies(good);
  const sessionToken = cookieValue(cookies, '__Host-cf_session');
  const csrfToken = cookieValue(cookies, '__Host-cf_csrf');
  assert.ok(sessionToken);
  assert.ok(csrfToken);
  assert.ok(cookies.some((cookie) => cookie.includes('__Host-cf_session=') && cookie.includes('HttpOnly') && cookie.includes('Secure')));
  assert.ok(cookies.some((cookie) => cookie.includes('__Host-cf_csrf=') && cookie.includes('Secure')));

  const sessionRequest = new Request('http://localhost/api/auth/me', {
    headers: { cookie: `__Host-cf_session=${encodeURIComponent(sessionToken)}` },
  });
  const meResponse = await me(sessionRequest);
  assert.equal(meResponse.status, 200);
  const meBody = await meResponse.json();
  assert.equal(meBody.user.username, admin.username);
  assert.equal('csrf_hash' in meBody, false);
  assert.equal('session_id' in meBody, false);

  globalThis.__characterForgeTestSession = { sessionToken, csrfToken };
});

test('logout requires CSRF, revokes the server session, and clears cookies', async () => {
  const { sessionToken, csrfToken } = globalThis.__characterForgeTestSession;
  const cookie = `__Host-cf_session=${encodeURIComponent(sessionToken)}; __Host-cf_csrf=${encodeURIComponent(csrfToken)}`;

  const rejected = await logout(new Request('http://localhost/api/auth/logout', {
    method: 'POST',
    headers: { cookie, 'x-csrf-token': 'wrong-csrf' },
  }));
  assert.equal(rejected.status, 403);
  assert.deepEqual(await rejected.json(), { error: 'csrf_invalid' });

  const stillLive = await me(new Request('http://localhost/api/auth/me', { headers: { cookie } }));
  assert.equal(stillLive.status, 200);

  const accepted = await logout(new Request('http://localhost/api/auth/logout', {
    method: 'POST',
    headers: { cookie, 'x-csrf-token': csrfToken },
  }));
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { ok: true });
  const cleared = setCookies(accepted);
  assert.ok(cleared.some((value) => value.includes('__Host-cf_session=') && value.includes('Max-Age=0')));
  assert.ok(cleared.some((value) => value.includes('__Host-cf_csrf=') && value.includes('Max-Age=0')));

  const revoked = await me(new Request('http://localhost/api/auth/me', { headers: { cookie } }));
  assert.equal(revoked.status, 401);
});
