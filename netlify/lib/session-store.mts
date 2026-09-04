import { getDatabase } from '@netlify/database';
import {
  SESSION_TTL_SECONDS,
  digestCredential,
  randomCredential,
} from './auth.mts';

const connectionString = process.env.NETLIFY_DB_URL;
const db = getDatabase(connectionString ? { connectionString } : undefined);

export type SessionUser = {
  id: number;
  username: string;
  role: 'admin' | 'dm' | 'player';
  display_name: string | null;
};

export async function createSession(userId: number) {
  const token = randomCredential();
  const csrf = randomCredential();
  const tokenHash = digestCredential(token);
  const csrfHash = digestCredential(csrf);

  await db.sql`
    INSERT INTO sessions (user_id, token_hash, csrf_hash, expires_at)
    VALUES (
      ${userId},
      ${tokenHash},
      ${csrfHash},
      CURRENT_TIMESTAMP + (${SESSION_TTL_SECONDS} * INTERVAL '1 second')
    )
  `;

  return { token, csrf };
}

export async function getSession(token: string | null | undefined) {
  if (!token) return null;
  const tokenHash = digestCredential(token);
  const rows = await db.sql<SessionUser & { csrf_hash: string; session_id: number }>`
    SELECT
      s.id AS session_id,
      s.csrf_hash,
      u.id,
      u.username,
      u.role,
      u.display_name
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
      AND s.revoked_at IS NULL
      AND s.expires_at > CURRENT_TIMESTAMP
    LIMIT 1
  `;

  if (!rows[0]) return null;

  await db.sql`
    UPDATE sessions
    SET last_seen_at = CURRENT_TIMESTAMP
    WHERE id = ${rows[0].session_id}
  `;

  return rows[0];
}

export async function revokeSession(token: string | null | undefined) {
  if (!token) return;
  const tokenHash = digestCredential(token);
  await db.sql`
    UPDATE sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE token_hash = ${tokenHash}
      AND revoked_at IS NULL
  `;
}

export function csrfMatches(sessionCsrfHash: string, presented: string | null | undefined) {
  if (!presented) return false;
  return digestCredential(presented) === sessionCsrfHash;
}

export async function __closeDatabaseForTests() {
  await db.end();
}
