# CharacterForge Netlify Operations

## Objective

Operate CharacterForge on Netlify without allowing preview work, environment configuration, rollback actions, or database recovery to mutate production unexpectedly.

This runbook is intentionally conservative. Production deployment and database recovery remain deliberate operator actions.

## Database isolation contract

CharacterForge uses Netlify Database branching as the isolation boundary.

- Production deploys are the only deploy context allowed to access the main production database.
- Deploy Previews use their own Netlify-managed database branch.
- A Deploy Preview database branch is isolated from production for both data and schema changes.
- Repository code must not manually inject, copy, or hard-code a production `NETLIFY_DB_URL` into Deploy Previews, branch deploys, CI, or browser code.
- `NETLIFY_DB_URL` is treated as a platform-managed Functions runtime value. CharacterForge does not define it in `netlify.toml` or GitHub Actions.
- Migrations remain versioned under `netlify/database/migrations/` so Netlify can apply the matching schema in each deploy context.

### Preview verification before production cutover

For the first deliberate Netlify project connection:

1. Create or open a pull request only after local and GitHub CI are green.
2. Confirm the Deploy Preview is using a database branch rather than the production database.
3. Create a disposable preview-only record with an unmistakable test name.
4. Confirm the record exists in the preview branch.
5. Confirm the record does not exist in production.
6. Delete or reset the preview branch after verification if the preview data is no longer needed.
7. Do not merge until the preview isolation check is documented in the pull request.

If preview isolation cannot be proven, do not publish production.

## Environment contract

CharacterForge currently requires no custom production application secret beyond Netlify-managed database connectivity.

The runtime database connection is `NETLIFY_DB_URL`, managed by Netlify Database for the active deploy context. Do not commit a value for it and do not manually create a shared value that spans production and Deploy Previews.

If future third-party secrets are added:

- store them in Netlify environment configuration, never repository source;
- scope them only to the Functions runtime unless a broader scope is technically required;
- use separate production and Deploy Preview values when a preview needs the integration;
- prefer a non-production/sandbox credential for Deploy Previews;
- do not expose server-only credentials to browser bundles;
- record the new variable name, scope, deploy contexts, owner, rotation process, and failure mode in this document before production use.

## Backup contract

Netlify Database automatically creates production backups on a schedule and when a production deploy is published. Backups contain both schema and data.

Before the first public production cutover:

1. Confirm the Database dashboard shows a recent production backup.
2. Record the backup timestamp in the release/cutover notes.
3. Confirm the current production deploy commit SHA is known.
4. Run the normal production smoke after publishing.

Do not create a custom scheduled backup workflow unless the platform backup model is later shown to be insufficient for the selected plan or recovery objective.

## Restore contract

Production database restore is a last-resort, manual recovery action.

- Do not automate database restore from GitHub Actions, Netlify build commands, scheduled functions, or application code.
- A restore replaces the production database branch with the selected backup's schema and data.
- Data written after that backup can be lost.
- Netlify preserves the pre-restore production state in a dedicated database branch as a fail-safe.
- Restoring the database does not automatically roll application code back to the matching deploy.
- A restore requires a Team Owner and must be coordinated with the code version that will serve the restored schema.

### Restore procedure

1. Stop or lock further production publishing while the incident is assessed.
2. Identify the known-good application commit and the candidate database backup timestamp.
3. Determine whether a targeted forward fix is safer than restoring older data.
4. If restore is necessary, use the Netlify Database dashboard as a Team Owner and select the intended backup explicitly.
5. Verify the pre-restore preservation branch exists after the restore.
6. Align the live application deploy with the restored schema/version if required.
7. Run the CharacterForge production smoke with the exact live 40-character commit SHA.
8. Verify login/bootstrap state, `/api/health`, admin access, campaign access, one representative character read, and print rendering.
9. Record the restore timestamp, selected backup, live commit SHA, verification result, and any known data-loss window.
10. Re-enable normal publishing only after verification passes.

## Rollback warning

Rolling an application deploy back does not automatically restore the database. Treat code rollback and database restore as two separate decisions.

Never assume a previous deploy is compatible with the current production schema. Check migration compatibility before changing either side.

## First production cutover gate

Production provisioning/publishing is allowed only after all of the following are true:

- exact-head GitHub CI is green;
- preview database isolation has been demonstrated;
- production database resources and expected credit impact are understood;
- a current production backup is visible;
- the exact production commit SHA is known;
- the manual production-smoke workflow is ready;
- no automatic deploy or automatic restore workflow has been introduced;
- the old Flask implementation is not exposed publicly as a competing backend.

## Credit discipline

CharacterForge should not use production deploys to discover failures that local Netlify Database tests, static/browser CI, or Deploy Preview checks can detect first. Production publishes are deliberate release events, not debugging iterations.
