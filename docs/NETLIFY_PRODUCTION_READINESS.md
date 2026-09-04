# CharacterForge Netlify production readiness

A CharacterForge Netlify deployment is ready to be treated as production only when all of these are true:

- CharacterForge Netlify Schema is green on the candidate commit.
- CharacterForge Netlify Frontend is green on the candidate commit.
- CharacterForge Netlify Operations is green on the candidate commit.
- CharacterForge Security Smoke is green on the candidate commit.
- CharacterForge History Secret Scan is green on the candidate commit.
- A controlled Deploy Preview has demonstrated that its database branch is isolated from production.
- No production `NETLIFY_DB_URL` or other production-only secret is manually injected into Deploy Preview or CI configuration.
- Production database resources and expected credit impact have been reviewed before provisioning/publishing.
- The Database dashboard shows a recent production backup before public cutover.
- The deliberate production deploy uses the same exact candidate commit that passed CI.
- The exact deployed HTTPS site URL and full 40-character Git SHA are recorded.
- CharacterForge Netlify Production Smoke is run manually against that URL and exact SHA.
- The production smoke is green before the deployment is treated as production-ready.
- The Flask reference implementation is not publicly exposed as a competing production backend.

The production smoke workflow verifies deployment state only. It does not deploy, retry, promote, roll back, or restore the site/database.

Database restore is a separate Team Owner recovery decision. Rolling application code back does not automatically restore database state.

See `docs/NETLIFY_OPERATIONS.md` for preview isolation, backup, restore, and incident-recovery rules.
