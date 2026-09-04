# CharacterForge Netlify runtime

This directory is the isolated Netlify-native migration surface. The Flask application at the repository root remains the certified behavioral reference until migration parity is green.

## Rules

- Do not point this code at production data during migration development.
- Do not create a production Netlify Database merely to test schema or authorization logic.
- Keep deploy-preview data separate from production data.
- Port authorization invariants before feature expansion.
- Preserve the Flask regression suite as the behavior contract until cutover.

## Initial layout

- `database/001_initial.sql` — Postgres schema contract for the current CharacterForge domain model.
- `functions/health.ts` — zero-dependency application health endpoint; it does not contact a database.
- `src/domain.ts` — shared role/entity contract used by the new runtime.
- `tests/schema-contract.mjs` — static schema checks that run without provisioning infrastructure.

A Netlify project configuration is intentionally not included yet. Adding deploy configuration is a later gate after local/API parity is proven.
