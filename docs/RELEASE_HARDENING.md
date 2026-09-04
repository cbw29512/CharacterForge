# Release hardening tracker

The current Flask implementation is now a hardened reference baseline. Production deployment remains separate because the target platform is Netlify and Netlify does not natively execute this Flask server.

## Closed on `release/public-hardening`

- [x] Remove reusable example database credentials from public setup docs
- [x] Require a unique `SECRET_KEY` of at least 32 characters
- [x] Remove automatic known admin/DM/player account seeding
- [x] First-launch admin setup only
- [x] Normalize account password minimum to 12 characters
- [x] Scope DM NPC edit/delete permissions to ownership/campaign ownership
- [x] Prevent arbitrary campaign assignment during character creation
- [x] Restrict character-sheet visibility to authorized users
- [x] Add authorization/security regression tests
- [x] Add explicit HttpOnly/SameSite session-cookie defaults
- [x] Add non-breaking browser security headers
- [x] Make Flask debug mode opt-in instead of default-on
- [x] Repair login/setup labeling and keyboard-accessible role selection
- [x] Align first-launch password help text with the backend policy
- [x] Repair wizard AI frontend/backend endpoint and payload contract
- [x] Add global Flask-WTF CSRF protection for forms and same-origin JSON POSTs
- [x] Remove tracked timestamped backups and ignore `*.bak.*`
- [x] Upgrade rendered accessibility tooling to Pa11y 10
- [x] Audit setup, login, admin, DM, player, campaign, builder, and sheet surfaces with rendered WCAG checks
- [x] Add authenticated Chromium desktop/mobile browser regression
- [x] Add 390px horizontal-overflow regression for player dashboard and character sheet
- [x] Generate a real Letter PDF in CI and validate its parseability, page count, and character identity
- [x] Remove obsolete root `PATCH_*.ps1` source generators
- [x] Remove obsolete machine-specific installers containing stale embedded secret/debug configuration
- [x] Security Smoke run #61 passed on exact head `66abf019d190eaf5105b5c2849292540a81258c0`

## Remaining production work

These are migration/deployment concerns, not unresolved defects in the hardened Flask baseline:

- [ ] Migrate the backend to a Netlify-supported runtime rather than attempting to deploy Flask as a Netlify Function
- [ ] Migrate durable relational persistence to Netlify Database / Postgres
- [ ] Replace filesystem-backed production sessions with durable Netlify-compatible session storage
- [ ] Decide the hosted AI boundary; localhost Ollama must remain local-only unless a remote provider is deliberately selected
- [ ] Document database backup/recovery and restore testing
- [ ] Add production HTTPS cookie verification
- [ ] Add actual deployed security-header and end-to-end production smoke checks
- [ ] Add production mobile/desktop performance budgets after the Netlify-native runtime exists
- [ ] Require green release CI before `main` changes where repository permissions allow

The Flask baseline may be merged as the secured reference implementation. Production deployment must wait for the Netlify migration gates in `docs/NETLIFY_MIGRATION.md`.
