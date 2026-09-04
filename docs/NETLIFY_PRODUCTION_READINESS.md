# CharacterForge Netlify production readiness

A CharacterForge Netlify deployment is ready to be treated as production only when all of these are true:

- Netlify Schema workflow is green on the candidate commit.
- Netlify Frontend workflow is green on the candidate commit.
- CharacterForge Security Smoke is green on the candidate commit.
- CharacterForge History Secret Scan is green on the candidate commit.
- The deliberate deploy uses that exact commit.
- The manual CharacterForge Netlify Production Smoke workflow is green for the deployed HTTPS URL and the same full commit SHA.

The smoke workflow verifies deployment state only; it does not deploy, retry, or promote the site.
