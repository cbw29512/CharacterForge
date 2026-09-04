# CharacterForge

CharacterForge is a tabletop RPG character-management and printable-sheet project focused on making character creation and campaign use easier for players and DMs.

## Current status

**Public repository / hardened Flask reference / Netlify-native migration substantially implemented / not yet production-deployed.**

The Flask application remains the behavioral reference and continues to pass security, authorization, rendered-accessibility, authenticated-browser, 390px mobile-overflow, and printable-PDF regression gates.

The Netlify migration now includes:

- versioned Postgres schema and repeatable migrations
- durable opaque server-side sessions
- first-admin bootstrap, login, session restore, and POST logout
- CSRF-protected state-changing APIs
- protected campaign, membership, character, SRD, and template operations
- modular static Netlify frontend for auth, campaigns, characters, and templates
- server-authorized UI capability flags
- strict production security headers and CSP
- exact build provenance through `/build-info.json`
- manual-only production smoke verification for deployed SHA, security headers, and database/schema health
- eight-page static WCAG coverage
- browser-backed 390px overflow regression across all eight static pages
- browser-backed Letter-print/PDF regression for the Netlify character sheet

No Netlify production site or database has been deliberately provisioned or promoted yet. Production deployment remains an explicit cutover step after the remaining operational readiness work is complete.

## Current architecture

### Flask reference

- Python / Flask application factory (`app.py`)
- Flask-SQLAlchemy persistence
- Flask-Session server-side sessions
- Blueprints for auth, admin, DM, player, campaigns, characters, and templates
- optional Ollama integration for local AI-assisted features
- printable character sheets

### Netlify target

- static frontend under `site/`
- Netlify Functions under `netlify/functions/`
- Netlify Database / Postgres migrations under `netlify/database/migrations/`
- opaque server-side sessions with secure cookies
- shared SRD catalog and parity contracts
- exact build provenance and explicit-only production smoke verification

## Local development

Use Python 3.12 and create a virtual environment. Never reuse example credentials from documentation.

Create a `.env` file with your own values:

```text
SECRET_KEY=<generate-a-long-random-secret>
DATABASE_URL=<your-local-database-url>
OLLAMA_URL=http://localhost:4242
FLASK_ENV=development
FLASK_PORT=5050
```

See `CharacterForge_SETUP_GUIDE.md` for the current Windows-oriented Flask setup notes.

## Quality gates

The repository verifies both the Flask reference and the Netlify-native migration.

### Flask reference gate

- no default or committed production credentials
- strict session-secret configuration
- authentication and authorization regression coverage
- CSRF/session/security-header behavior
- rendered WCAG checks for setup, login, role dashboards, campaigns, builder, and character sheet
- authenticated Chromium desktop/mobile smoke
- 390px horizontal-overflow regression
- Letter-size printable-sheet PDF generation and parsed-PDF validation

### Netlify migration gates

- versioned Postgres schema constraints and migrations
- auth/session/CSRF lifecycle contracts
- campaign ownership and membership authorization
- campaign-owner membership immutability
- character read/create/delete authorization
- shared SRD parity and character-creation math
- template ownership and lifecycle authorization
- static frontend security contract
- eight-page static WCAG audit
- browser-backed 390px no-overflow regression
- browser-backed Letter character-sheet print/PDF regression
- exact CI/deploy build provenance
- production-smoke verifier self-tests
- secret-history scan

## Netlify production direction

CharacterForge is being moved to a Netlify-native frontend, Functions runtime, and Postgres database rather than wrapping the Flask application in a fake Netlify deployment.

The remaining major work before deliberate production cutover is now primarily operational and administrative: admin/user-management parity beyond first-admin bootstrap, backup/restore procedure, preview-versus-production database isolation, production secrets/resource configuration, and the first intentional Netlify deployment plus manual smoke verification.

See:

- `docs/NETLIFY_MIGRATION.md` — migration Definition of Done and sequencing
- `docs/NETLIFY_PRODUCTION_READINESS.md` — production readiness criteria
- `docs/NETLIFY_DEPLOY_CHECKLIST.md` — deliberate deployment checklist
- `docs/NETLIFY_PRODUCTION_SMOKE.md` — exact deployed-SHA verification procedure

## Safety and rules boundary

CharacterForge is a tabletop gaming utility. Rules data and generated content should be reviewed by the DM/player before use. The project should avoid representing unofficial or generated material as official rules text.

## Support

If CharacterForge is useful to your table, you can support continued development here:

**Buy Me a Coffee:** https://buymeacoffee.com/divclass016

## Repository hygiene

Historical root patch generators, machine-specific installers, timestamped backups, and stale embedded-secret/debug setup artifacts have been removed from the current tree. Git history still preserves prior development history.
