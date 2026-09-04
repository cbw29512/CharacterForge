# CharacterForge

CharacterForge is a tabletop RPG character-management and printable-sheet project focused on making character creation and campaign use easier for players and DMs.

## Current status

**Public repository / Netlify-native migration substantially complete / not yet production-deployed.**

The hardened Flask application remains the behavioral reference implementation. The Netlify target now has versioned Postgres migrations, server-side authentication/session handling, campaign and membership APIs, character and SRD-backed builder flows, reusable templates, admin/user-management parity, a modular static frontend, Letter print behavior, 390px mobile protection, WCAG regression coverage, exact-build provenance, and a verification-only production smoke checker.

Production provisioning is intentionally still pending. CharacterForge will not spend production deploy credits to discover failures that local database tests, CI, browser checks, or a controlled Deploy Preview can catch first.

## Architecture

### Netlify production target

- Netlify-hosted static frontend
- Netlify Functions on Node 24
- Netlify Database / Postgres
- versioned migrations under `netlify/database/migrations/`
- opaque server-side sessions with secure host-only cookies
- CSRF protection on state-changing browser requests
- role and ownership authorization for admin, DM, and player workflows
- browser-based Letter character-sheet printing
- exact-commit build provenance and manual production smoke verification

### Hardened Flask reference

- Python / Flask application factory (`app.py`)
- Flask-SQLAlchemy persistence
- Flask-Session server-side sessions
- Blueprints for auth, admin, DM, player, campaigns, characters, and templates
- optional local Ollama integration
- printable character sheets

The Flask implementation remains the regression reference during cutover; it is not the planned Netlify production backend.

## Verified Netlify feature surface

Current local/CI contracts cover:

- first-admin bootstrap with no seeded/default account
- login, logout, secure cookies, CSRF, and durable server-side sessions
- case-insensitive usernames and password policy
- campaign create/list/browse/join/approve/kick/delete flows
- campaign owner membership immutability
- character visibility, creation, deletion, and campaign authorization
- shared SRD catalog parity and character math
- reusable character/NPC templates
- admin overview and user creation
- transactional role changes with last-admin and campaign-owner safeguards
- password reset with active-session revocation
- user deletion with self-delete, last-admin, and owned-campaign protection
- nine-page static frontend WCAG coverage
- nine-page 390px horizontal-overflow regression
- Letter print-media/PDF regression
- production security-header verification contract
- exact deployed-SHA verification contract
- read-only database health verification
- no automatic production deploy path
- no automatic database restore path

## Operational guardrails

CharacterForge uses Netlify Database branching as the intended preview/prod isolation boundary. Production deploys must be the only context with access to the main production database; Deploy Previews use isolated database branches.

Repository policy forbids committing or manually injecting a production `NETLIFY_DB_URL` into preview/CI configuration. Database restore remains a manual Team Owner recovery action and is never triggered from GitHub Actions or application code.

See:

- `docs/NETLIFY_MIGRATION.md` — migration Definition of Done and cutover state
- `docs/NETLIFY_OPERATIONS.md` — preview isolation, environment, backup, restore, and cutover runbook
- `docs/NETLIFY_PRODUCTION_READINESS.md` — production readiness criteria
- `docs/NETLIFY_DEPLOY_CHECKLIST.md` — deliberate first-deploy checklist
- `docs/NETLIFY_PRODUCTION_SMOKE.md` — exact-SHA production verification

## Local Flask development

Use Python 3.12 and create a virtual environment. Never reuse example credentials from documentation.

Create a `.env` file with your own local values:

```text
SECRET_KEY=<generate-a-long-random-secret>
DATABASE_URL=<your-local-database-url>
OLLAMA_URL=http://localhost:4242
FLASK_ENV=development
FLASK_PORT=5050
```

See `CharacterForge_SETUP_GUIDE.md` for the current Windows-oriented Flask setup notes.

## Safety and rules boundary

CharacterForge is a tabletop gaming utility. Rules data and generated content should be reviewed by the DM/player before use. The project should avoid representing unofficial or generated material as official rules text.

## Support

If CharacterForge is useful to your table, you can support continued development here:

**Buy Me a Coffee:** https://buymeacoffee.com/divclass016

## Repository hygiene

Historical root patch generators, machine-specific installers, timestamped backups, and stale embedded-secret/debug setup artifacts have been removed from the current tree. Git history still preserves prior development history.
