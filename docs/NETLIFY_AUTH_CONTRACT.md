# CharacterForge Netlify Authentication Contract

## Objective

Port CharacterForge authentication to Netlify Functions without weakening the certified Flask behavior or forcing existing users to reset passwords.

## Password compatibility

The Flask reference uses bcrypt hashes. The Netlify runtime must continue verifying those hashes during migration. New password writes must also use bcrypt until a deliberate, tested password-migration plan says otherwise.

Rules:

- minimum password length remains 12 characters
- plaintext passwords are never logged, returned, or stored
- password hashes remain server/database-only
- username lookup remains case-insensitive
- role hints never override the stored role

## First administrative bootstrap

The existing first-launch invariant remains authoritative:

- setup is allowed only while no `admin` user exists
- the setup operation re-checks that invariant inside the database transaction
- it creates exactly one requested admin account; it does not seed default users
- once any admin exists, public bootstrap is closed

## Session model

Authentication uses opaque server-side sessions.

Browser credential:

- cookie name: `__Host-cf_session`
- random value generated with a cryptographically secure RNG
- `Secure`
- `HttpOnly`
- `SameSite=Lax`
- `Path=/`
- no `Domain` attribute

Database representation:

- only SHA-256 of the raw session token is stored
- sessions belong to one user
- sessions have explicit creation, last-seen, expiry, and revocation timestamps
- logout revokes the server-side row and deletes the cookie
- expired/revoked sessions never authenticate a request

## CSRF model

State-changing browser requests require a session-bound anti-forgery value in addition to the session cookie.

- cookie name: `__Host-cf_csrf`
- random value separate from the session token
- `Secure`
- readable by same-origin browser code (not `HttpOnly`) so it can be copied into an `X-CSRF-Token` header
- `SameSite=Lax`
- `Path=/`
- database stores only its SHA-256 digest
- mutation requests require the header value to match the CSRF cookie and the stored digest
- same-origin `Origin` validation is an additional invariant for browser mutation endpoints

`SameSite` is defense-in-depth; it is not the only CSRF control.

## Session lifecycle

1. Login verifies username/password against Postgres.
2. A fresh session and CSRF value are generated after successful authentication.
3. Only their digests are persisted.
4. Secure cookies are returned to the browser.
5. Protected Functions resolve the session row and user on each request.
6. Logout revokes the session before deleting cookies.
7. Expired rows are invalid and may be cleaned up asynchronously/lazily.

## Authorization boundary

Authentication establishes identity only. It does not grant campaign or character access by itself.

Every protected domain operation must continue enforcing the hardened Flask authorization invariants for admin, DM, campaign membership, character ownership, and NPC ownership.

## Migration sequencing

1. Session schema and cryptographic utility tests.
2. Read-only session resolution helper.
3. First-admin setup endpoint.
4. Login endpoint.
5. Current-session (`/api/auth/me`) endpoint.
6. Logout endpoint with CSRF/origin enforcement.
7. Port protected domain APIs only after auth contract tests are green.

No production Netlify project/database is required for these steps; they must pass against the local Netlify Postgres harness first.
