import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { NetlifyDB } from '@netlify/database-dev';

let db;
let connectionString;
let health;
let closeDatabaseForTests;
const originalDatabaseUrl = process.env.NETLIFY_DB_URL;

before(async () => {
  db = new NetlifyDB({ logger: () => {} });
  connectionString = await db.start();
  await db.applyMigrations('./netlify/database/migrations');
  process.env.NETLIFY_DB_URL = connectionString;
  ({ default: health, closeDatabaseForTests } = await import('../netlify/functions/health.mts'));
});

after(async () => {
  if (closeDatabaseForTests) await closeDatabaseForTests();
  if (originalDatabaseUrl === undefined) delete process.env.NETLIFY_DB_URL;
  else process.env.NETLIFY_DB_URL = originalDatabaseUrl;
  if (db) await db.stop();
});

test('health reports the migrated schema as reachable', async () => {
  const response = await health(new Request('http://localhost/api/health', { method: 'GET' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');

  const body = await response.json();
  assert.deepEqual(body, {
    ok: true,
    service: 'characterforge',
    database: 'reachable',
    schema: 1,
  });
  assert.equal(JSON.stringify(body).includes(connectionString), false);
});

test('health rejects state-changing methods', async () => {
  const response = await health(new Request('http://localhost/api/health', { method: 'POST' }));
  assert.equal(response.status, 405);
  assert.deepEqual(await response.json(), { ok: false, error: 'method_not_allowed' });
});
