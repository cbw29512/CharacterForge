# CharacterForge Netlify Migration

## Objective

Move CharacterForge from its hardened Flask reference implementation to a Netlify-native production architecture without weakening authentication, authorization, accessibility, print behavior, or rules/domain behavior.

This is a migration, not a blind rewrite. Existing regression behavior is the contract.

## Platform decision

The production target is Netlify. The existing Python/Flask server is retained as the behavioral reference and local-development baseline, but it is not treated as deployable Netlify Functions code.

Target production primitives:

- Netlify-hosted frontend
- Netlify Functions using a currently supported Netlify runtime
- Netlify Database / Postgres for durable relational data
- environment-managed production secrets
- browser-based printable character sheets

Local-only Ollama integration remains optional until a production-safe remote AI provider is explicitly selected.

## Verified implementation progress

Completed and CI-certified:

- versioned Postgres schema and repeatable migrations
- durable opaque server-side sessions
- first-admin bootstrap, login, session lookup, and POST logout
- secure session/CSRF cookie contract
- campaign list/create/browse/join/approve/kick/delete authorization
- campaign detail and membership manager views
- campaign-owner membership immutability
- protected character read/create/delete operations
- shared SRD catalog and Flask/Netlify parity contracts
- template list/save/use/delete ownership lifecycle
- modular static Netlify frontend for auth, campaigns, characters, and templates
- static frontend security headers and CSP
- eight-page static WCAG gate
- browser-backed 390px no-overflow regression across all eight static pages
- Letter print CSS plus browser-backed character-sheet PDF generation
- exact build provenance through `/build-info.json`
- manual-only production smoke checker for exact deployed SHA, security headers, and database/schema health

Still intentionally incomplete before production cutover:

- admin/user-management parity beyond first-admin bootstrap
- production secrets/resource configuration
- backup and restore procedure
- deploy-preview versus production database isolation
- first deliberate Netlify deployment
- first real production smoke run

## State / data model to preserve

Migration must preserve these domain entities and relationships before feature work expands:

- `User`
  - id
  - username
  - password credential representation
  - role: `admin | dm | player`
  - display name
- `Campaign`
  - id
  - name / description
  - owning DM
  - active state
- `CampaignMembership`
  - campaign
  - user
  - membership role
  - approval state
- `Character`
  - owner
  - optional campaign
  - PC/NPC classification
  - core abilities, combat values, proficiencies, equipment, features, traits, notes
- character/template ownership and campaign authorization relationships already enforced by the Flask regression suite

## Security invariants

The migration is not acceptable unless all of these remain true:

- no seeded/default production accounts
- no reusable example production passwords
- no predictable session/application secret
- first administrative bootstrap is explicit
- players cannot enter admin or DM-only surfaces
- DMs cannot mutate NPCs or campaigns they do not own/control
- campaign IDs cannot be injected to bypass membership/ownership checks
- private character sheets are not readable by unrelated authenticated users
- state-changing browser requests have CSRF or an equivalent same-origin anti-forgery control
- production cookies use HTTPS-appropriate security settings
- secrets never ship to browser bundles or repository source

## Definition of Done

### API and persistence

- [ ] Netlify-native API routes cover all required auth and user-management operations
- [x] Netlify-native API routes cover required campaign, membership, character, SRD, and template operations
- [x] Netlify Database schema represents the existing core domain model and constraints
- [x] migrations are versioned and repeatable
- [x] session/auth state is durable and does not depend on an ephemeral filesystem
- [x] authorization tests are ported for migrated campaign, character, and template surfaces

### UI

- [ ] existing role workflows remain usable, including remaining admin/user-management parity
- [x] builder behavior uses the shared certified SRD catalog for the migrated creation flow
- [x] character sheet has an explicit Letter print/PDF browser regression
- [x] all eight current static pages have an explicit 390px no-overflow browser regression
- [x] rendered WCAG checks cover all eight current static Netlify pages

### Operations

- [ ] production secrets come only from Netlify environment configuration
- [ ] database backups and restore procedure are documented and tested
- [ ] deploy previews never mutate production data
- [ ] production smoke proves the deployed commit/version on a real deployment
- [ ] security headers and HTTPS cookie properties are asserted against a real production deployment
- [ ] usage/credit impact is understood before enabling production database resources

Implemented but awaiting first real deployment:

- [x] exact deployed-commit build provenance is generated at build time
- [x] production smoke tooling is manual-only and verification-only
- [x] smoke tooling validates expected SHA, security headers, and database/schema health
- [x] production deployment readiness and deliberate-deploy checklists are documented

### Cutover

- [ ] migration parity suite green for all required production workflows
- [ ] production deployment green
- [ ] one controlled production smoke run green
- [x] old Flask deployment is not being exposed as a second competing public backend during migration

## Sequencing

1. Freeze the hardened Flask behavior as the reference contract. **Done.**
2. Define Netlify Database schema and migrations. **Done for the core domain.**
3. Port authentication/session boundaries. **Done for bootstrap/login/session/logout.**
4. Port authorization-protected API operations. **Done for campaign, character, SRD, and template surfaces; admin/user management remains.**
5. Connect the frontend to the new API. **Substantially done for current migrated workflows.**
6. Port print/export behavior and authenticated accessibility gates. **Done for current Netlify static pages and character sheet.**
7. Add preview/prod isolation, backup/recovery, and production smoke. **Smoke tooling done; isolation and backup/recovery remain.**
8. Cut over only after parity is green. **Not started.**

Do not burn production deploy credits to discover problems that local/CI parity tests can detect first.
