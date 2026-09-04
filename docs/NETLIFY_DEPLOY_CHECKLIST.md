# CharacterForge deliberate Netlify deploy checklist

Use this only when CharacterForge is ready for an intentional Netlify deployment.

## Before connecting/publishing

1. Confirm the candidate Git commit is fully green in CharacterForge Netlify Schema, Netlify Frontend, Netlify Operations, Security Smoke, and History Secret Scan.
2. Confirm production database resources and expected credit impact are understood before provisioning.
3. Confirm no repository or CI configuration manually supplies a production `NETLIFY_DB_URL` to Deploy Previews.
4. Create the Netlify project/database deliberately; do not use production publishes as a debugging loop.
5. Use one controlled Deploy Preview to prove database branch isolation:
   - create an unmistakable preview-only record;
   - confirm it exists in the preview branch;
   - confirm it does not exist in production;
   - record the result in the pull request/release notes.
6. Do not continue to production if preview isolation cannot be proven.

## Before the first production publish

7. Confirm the Database dashboard shows a recent production backup and record its timestamp.
8. Confirm the exact candidate commit SHA is still the fully green head being released.
9. Confirm the Flask reference implementation will not remain exposed as a competing public backend.
10. Publish that exact candidate commit deliberately through the configured Netlify project.

## After production publish

11. Record the exact deployed HTTPS site URL and full 40-character Git SHA.
12. Run **CharacterForge Netlify Production Smoke** manually with those two values.
13. Require a green smoke result before treating the deploy as production-ready.
14. If smoke reports a SHA mismatch, security-header failure, or database/schema failure, do not treat the deployment as production-ready.
15. Record the smoke result and any rollback/recovery decision in the release notes.

## Important recovery rule

Application rollback and database restore are separate operations. Rolling code back does not automatically restore database state. Database restore is a manual Team Owner recovery action governed by `docs/NETLIFY_OPERATIONS.md`.

The smoke workflow verifies an existing deployment only. It does not create, update, retry, promote, roll back, or restore a deployment/database.
