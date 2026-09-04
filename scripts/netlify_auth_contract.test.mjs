import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { NetlifyDB } from '@netlify/database-dev';
import pg from 'pg';
import {
  CSRF_COOKIE,
  MIN_PASSWORD_LENGTH,
  SESSION_COOKIE,
  csrfCookieOptions,
  digestCredential,
  hashPassword,
  normalizeUsername,
  randomCredential,
  safeEqual,
  sessionCookieOptions,
  validatePassword,
  verifyPassword,
} from '../netlify/lib/auth.mts';

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

test('auth primitives preserve the hardened Flask password policy', async () => {
  assert.equal(MIN_PASSWORD_LENGTH, 12);
  assert.throws(() => validatePassword('short-pass'), /at least 12/i);
  const password = 'correct-horse-battery';
  const hash = await hashPassword(password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
  assert.equal(normalizeUsername('  AdminUser  '), 'adminuser');
});

test('opaque credentials are random, digest-only, and constant-time comparable', () => {
  const first = randomCredential();
  const second = randomCredential();
  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
  const digest = digestCredential(first);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(digest.includes(first), false);
  assert.equal(safeEqual(digest, digest), true);
  assert.equal(safeEqual(digest, digestCredential(second)), false);
});

test('session cookie is host-only secure and inaccessible to client JavaScript', () => {
  assert.equal(SESSION_COOKIE, '__Host-cf_session');
  const options = sessionCookieOptions();
  assert.equal(options.path, '/');
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.httpOnly, true);
  assert.equal('domain' in options, false);
});

test('csrf cookie is secure but readable for double-submit protection', () => {
  assert.equal(CSRF_COOKIE, '__Host-cf_csrf');
  const options = csrfCookieOptions();
  assert.equal(options.path, '/');
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.httpOnly, false);
  assert.equal('domain' in options, false);
});

test('session table stores only credential digests and revocation metadata', async () => {
  await withClient(async (client) => {
    const user = await client.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'player') RETURNING id`,
      ['auth-contract-user', 'existing-bcrypt-hash'],
    );
    const rawToken = randomCredential();
    const rawCsrf = randomCredential();
    const tokenHash = digestCredential(rawToken);
    const csrfHash = digestCredential(rawCsrf);
    const { rows } = await client.query(
      `INSERT INTO sessions (user_id, token_hash, csrf_hash, expires_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '7 days')
       RETURNING token_hash, csrf_hash, revoked_at`,
      [user.rows[0].id, tokenHash, csrfHash],
    );
    assert.equal(rows[0].token_hash, tokenHash);
    assert.equal(rows[0].csrf_hash, csrfHash);
    assert.equal(rows[0].token_hash.includes(rawToken), false);
    assert.equal(rows[0].csrf_hash.includes(rawCsrf), false);
    assert.equal(rows[0].revoked_at, null);
  });
});

test('session rows cascade when their user is deleted', async () => {
  await withClient(async (client) => {
    const user = await client.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'player') RETURNING id`,
      ['cascade-session-user', 'hash'],
    );
    const tokenHash = digestCredential(randomCredential());
    await client.query(
      `INSERT INTO sessions (user_id, token_hash, csrf_hash, expires_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '1 hour')`,
      [user.rows[0].id, tokenHash, digestCredential(randomCredential())],
    );
    await client.query(`DELETE FROM users WHERE id = $1`, [user.rows[0].id]);
    const result = await client.query(`SELECT COUNT(*)::int AS count FROM sessions WHERE token_hash = $1`, [tokenHash]);
    assert.equal(result.rows[0].count, 0);
  });
});
