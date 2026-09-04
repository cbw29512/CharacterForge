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

- [ ] Netlify-native API routes cover the required auth, user, campaign, membership, character, and template operations
- [ ] Netlify Database schema represents the existing domain model and constraints
- [ ] migrations are versioned and repeatable
- [ ] session/auth state is durable and does not depend on an ephemeral filesystem
- [ ] authorization tests are ported before feature parity is declared

### UI

- [ ] existing role workflows remain usable
- [ ] builder behavior remains equivalent for supported features
- [ ] character sheet remains printable on Letter paper
- [ ] mobile layouts do not horizontally overflow at 390px
- [ ] rendered WCAG checks cover public and authenticated critical paths

### Operations

- [ ] production secrets come only from Netlify environment configuration
- [ ] database backups and restore procedure are documented and tested
- [ ] deploy previews never mutate production data
- [ ] production smoke proves the deployed commit/version
- [ ] security headers and HTTPS cookie properties are asserted against production
- [ ] usage/credit impact is understood before enabling production database resources

### Cutover

- [ ] migration parity suite green
- [ ] production deployment green
- [ ] one controlled production smoke run green
- [ ] old Flask deployment is not publicly exposed as a second competing backend

## Sequencing

1. Freeze the hardened Flask behavior as the reference contract.
2. Define Netlify Database schema and migrations.
3. Port authentication/session boundaries.
4. Port authorization-protected API operations.
5. Connect the frontend to the new API.
6. Port print/export behavior and authenticated accessibility gates.
7. Add preview/prod isolation, backup/recovery, and production smoke.
8. Cut over only after parity is green.

Do not burn production deploy credits to discover problems that local/CI parity tests can detect first.
