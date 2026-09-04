import {
  SESSION_TTL_SECONDS,
  digestCredential,
  randomCredential,
  safeEqual,
} from './auth.mts';
import { getPool } from './pg.mts';

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

  await getPool().query(
    `INSERT INTO sessions (user_id, token_hash, csrf_hash, expires_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP + ($4 * INTERVAL '1 second'))`,
    [userId, tokenHash, csrfHash, SESSION_TTL_SECONDS],
  );

  return { token, csrf };
}

export async function getSession(token: string | null | undefined) {
  if (!token) return null;
  const tokenHash = digestCredential(token);
  const { rows } = await getPool().query<SessionUser & { csrf_hash: string; session_id: number }>(
    `SELECT
       s.id AS session_id,
       s.csrf_hash,
       u.id,
       u.username,
       u.role,
       u.display_name
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > CURRENT_TIMESTAMP
     LIMIT 1`,
    [tokenHash],
  );

  if (!rows[0]) return null;

  await getPool().query(
    `UPDATE sessions
     SET last_seen_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [rows[0].session_id],
  );

  return rows[0];
}

export async function revokeSession(token: string | null | undefined) {
  if (!token) return;
  const tokenHash = digestCredential(token);
  await getPool().query(
    `UPDATE sessions
     SET revoked_at = CURRENT_TIMESTAMP
     WHERE token_hash = $1
       AND revoked_at IS NULL`,
    [tokenHash],
  );
}

export function csrfMatches(sessionCsrfHash: string, presented: string | null | undefined) {
  if (!presented) return false;
  return safeEqual(digestCredential(presented), sessionCsrfHash);
}
