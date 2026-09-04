# CharacterForge Netlify Migration

## Objective

Move CharacterForge from its hardened Flask reference implementation to a Netlify-native production architecture without weakening authentication, authorization, accessibility, print behavior, or rules/domain behavior.

This is a migration, not a blind rewrite. Existing regression behavior remains the contract.

## Current state

**Feature parity is substantially complete. Operational cutover is the remaining phase.**

The Netlify target now includes:

- versioned Postgres schema and migrations
- durable opaque server-side sessions
- first-admin bootstrap
- login/logout/CSRF/security-cookie boundaries
- campaign and membership lifecycle
- character visibility, creation, deletion, and SRD-backed builder flows
- reusable templates
- admin/user-management parity
- modular static frontend
- WCAG coverage across nine static pages
- 390px horizontal-overflow regression across nine static pages
- Letter print-media/PDF regression
- exact-commit build provenance
- verification-only production smoke tooling
- operational isolation/recovery policy enforced in CI

No CharacterForge production Netlify project/database has been deliberately provisioned or promoted yet.

## Platform decision

The production target is Netlify. The existing Python/Flask server is retained as the behavioral reference and local-development baseline, but it is not treated as deployable Netlify Functions code.

Target production primitives:

- Netlify-hosted frontend
- Netlify Functions on Node 24
- Netlify Database / Postgres
- platform-managed database connectivity
- environment-managed future third-party secrets
- browser-based printable character sheets

Local-only Ollama integration remains optional until a production-safe remote AI provider is explicitly selected.

## State / data model

The Netlify schema preserves these core entities and relationships:

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
- `CharacterTemplate`
  - owner
  - PC/NPC classification
  - reusable build snapshot
- `Session`
  - user
  - opaque token digest
  - CSRF digest
  - expiry / revocation metadata

## Security invariants

The migration is not acceptable unless all of these remain true:

- no seeded/default production accounts
- no reusable example production passwords
- no predictable session credential
- first administrative bootstrap is explicit
- players cannot enter admin or DM-only surfaces
- DMs cannot mutate NPCs or campaigns they do not own/control
- campaign IDs cannot be injected to bypass membership/ownership checks
- campaign owners cannot be silently removed or demoted into a role that strands ownership
- private character sheets are not readable by unrelated authenticated users
- state-changing browser requests require CSRF protection
- production cookies use HTTPS-appropriate security settings
- secrets never ship to browser bundles or repository source
- password reset revokes active target sessions
- the last administrator cannot be removed or demoted
- production database credentials are never manually injected into Deploy Previews or CI
- database restore cannot be triggered automatically from CI or application code

## Definition of Done

### API and persistence

- [x] Netlify-native API routes cover required auth, user, campaign, membership, character, and template operations
- [x] Netlify Database schema represents the existing domain model and constraints
- [x] migrations are versioned and repeatable
- [x] session/auth state is durable and does not depend on an ephemeral filesystem
- [x] authorization tests are ported and green
- [x] admin/user-management parity is implemented and regression-tested

### UI

- [x] existing role workflows remain usable on the static frontend
- [x] builder behavior remains equivalent for the supported SRD feature set
- [x] character sheet remains printable on Letter paper
- [x] mobile layouts do not horizontally overflow at 390px
- [x] rendered WCAG checks cover the full nine-page static surface
- [x] dynamic API data is rendered without unsafe HTML injection helpers

### Operations

- [x] production/preview database-isolation policy is documented and CI-enforced
- [x] repository configuration does not commit or inject `NETLIFY_DB_URL`
- [x] database backup/restore procedure is documented
- [x] automated database restore paths are forbidden by CI contract
- [x] production smoke tooling proves an exact deployed commit/version when run
- [x] production security headers are included in the smoke contract
- [ ] first real Deploy Preview demonstrates database-branch isolation from production
- [ ] production database resources and selected-plan credit impact are reviewed before provisioning
- [ ] a real production backup is visible before public cutover
- [ ] one controlled restore/recovery drill is evaluated after provisioning when safe and appropriate

### Cutover

- [x] migration parity suite green
- [x] static frontend/mobile/print/WCAG parity suite green
- [x] operational policy gate exists without deployment capability
- [ ] first deliberate Netlify project/database provisioning complete
- [ ] controlled Deploy Preview green
- [ ] production deployment green
- [ ] one controlled production smoke run green against the exact live SHA
- [ ] old Flask implementation is not publicly exposed as a competing backend

## Sequencing from here

1. Keep local/CI parity green on exact heads.
2. Review Netlify plan/credit implications for the project and database.
3. Provision the CharacterForge Netlify project/database deliberately.
4. Use one controlled Deploy Preview to prove database branch isolation and full app behavior.
5. Confirm a production backup is available before cutover.
6. Publish production only after preview evidence and exact-head CI are green.
7. Run the manual production smoke against the exact live 40-character commit SHA.
8. Keep Flask as reference code, not as a second public production backend.

Do not burn production deploy credits to discover problems that local/CI parity tests or a controlled Deploy Preview can detect first.
