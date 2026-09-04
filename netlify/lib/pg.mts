import pg from 'pg';

const { Pool } = pg;

function requireDatabaseUrl() {
  const connectionString = process.env.NETLIFY_DB_URL;
  if (!connectionString) throw new Error('NETLIFY_DB_URL is required');
  return connectionString;
}

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: requireDatabaseUrl(),
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function __closePoolForTests() {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  await current.end();
}
