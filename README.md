# CharacterForge

CharacterForge is a tabletop RPG character-management and printable-sheet project focused on making character creation and campaign use easier for players and DMs.

## Current status

**Public repository / hardened Flask reference implementation / not yet production-deployed.** The current Flask application has passed its security, authorization, rendered-accessibility, authenticated-browser, mobile-overflow, and printable-PDF regression gates. The next phase is a deliberate Netlify-native backend migration rather than deploying the Flask server unchanged.

## Current architecture

- Python / Flask application factory (`app.py`)
- Flask-SQLAlchemy persistence
- Flask-Session server-side sessions
- Blueprints for auth, admin, DM, player, campaigns, characters, and templates
- Optional Ollama integration for local AI-assisted features
- Printable character sheets

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

See `CharacterForge_SETUP_GUIDE.md` for the current Windows-oriented setup notes.

## Quality gate

The hardened Flask implementation currently verifies:

- no default or committed production credentials
- strict session-secret configuration
- authentication and authorization regression coverage
- CSRF/session/security-header behavior
- 29 Python/security regression tests
- rendered WCAG checks for setup, login, role dashboards, campaigns, builder, and character sheet
- authenticated Chromium desktop/mobile smoke
- 390px horizontal-overflow regression
- Letter-size printable-sheet PDF generation and parsed-PDF validation

## Netlify production direction

Netlify's current native Functions runtime does not run Python/Flask applications directly. CharacterForge therefore will not use a fake Flask-on-Netlify wrapper. The planned production direction is a Netlify-native API/runtime with Netlify Database (Postgres), while preserving the proven domain rules and UI behavior from this Flask implementation.

See `docs/NETLIFY_MIGRATION.md` for the migration Definition of Done, state model, boundaries, and sequencing.

## Safety and rules boundary

CharacterForge is a tabletop gaming utility. Rules data and generated content should be reviewed by the DM/player before use. The project should avoid representing unofficial or generated material as official rules text.

## Support

If CharacterForge is useful to your table, you can support continued development here:

**Buy Me a Coffee:** https://buymeacoffee.com/divclass016

## Repository hygiene

Historical root patch generators, machine-specific installers, timestamped backups, and stale embedded-secret/debug setup artifacts have been removed from the current tree. Git history still preserves prior development history.
