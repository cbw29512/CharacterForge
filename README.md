# CharacterForge

CharacterForge is a Flask-based tabletop RPG character-management and printable-sheet project focused on making character creation and campaign use easier for players and DMs.

## Current status

**Active development / pre-production.** The application includes authentication, role-based dashboards, campaigns, characters, templates, printable character sheets, and a hardened character-creation path. Production deployment should wait until the security, CI, accessibility, and deployment gates documented below are complete.

## Architecture

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

## Production Definition of Done

CharacterForge is ready for public production only when all of the following are green:

- No default or committed production credentials/secrets
- Dependency and secret scanning
- Automated unit/integration tests
- Authentication and authorization regression tests
- WCAG accessibility checks
- Mobile and desktop production smoke tests
- Printable-sheet regression tests
- Security-header verification
- Production database configuration separated from local development
- Documented backup/recovery path for persistent data
- Netlify-compatible deployment architecture confirmed before production cutover

## Safety and rules boundary

CharacterForge is a tabletop gaming utility. Rules data and generated content should be reviewed by the DM/player before use. The project should avoid representing unofficial or generated material as official rules text.

## Support

If CharacterForge is useful to your table, you can support continued development here:

**Buy Me a Coffee:** https://buymeacoffee.com/divclass016

## Repository hygiene

Several PowerShell files in the repository are historical setup/patch tooling from earlier development. They are being audited before consolidation or archival so working behavior is not removed accidentally.
