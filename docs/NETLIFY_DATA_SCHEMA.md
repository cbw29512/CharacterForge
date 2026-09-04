# CharacterForge Netlify Data Schema

## Objective

Preserve the hardened Flask domain model while moving persistence to Netlify Database / Postgres. The database schema is a security boundary, not only storage.

## Ownership model

### User

A user has exactly one role: `admin`, `dm`, or `player`.

- usernames are unique case-insensitively
- passwords are stored only as hashes
- the database never seeds production users
- administrative bootstrap remains an explicit application workflow

### Campaign

A campaign has one owning DM (`dm_id`).

- deleting an owning DM is restricted while campaigns still reference that account
- membership rows are deleted with their campaign or user
- a `(campaign_id, user_id)` pair is unique

### Character

A character may belong to a user and/or campaign.

- PCs normally retain an `owner_id`
- NPCs retain the creator/owner id even when not assigned to a campaign
- deleting a user sets character ownership to null rather than deleting the character
- deleting a campaign deletes characters attached to that campaign, matching the existing Flask relationship behavior
- application authorization must still prove campaign/character access; foreign keys do not replace authorization checks

### Character template

Templates are private user-owned reusable builds.

- deleting the owner deletes their templates
- template JSON payloads are native Postgres `jsonb`

## JSON representation

The Flask reference stores several structured fields as JSON text. The Netlify schema promotes these to `jsonb` while preserving their shapes:

- `skills`: object
- `saving_throws`: object
- `equipment`: array
- `spells`: object
- `features`: array
- `traits`: object
- `attacks`: array

No API migration is complete until serialization/parity tests prove the old and new representations are behaviorally equivalent.

## Database invariants

The initial migration enforces:

- allowed user/membership roles
- case-insensitive username uniqueness
- one membership per user per campaign
- ability scores and character/template levels within the existing supported range
- non-negative HP, speed, XP, and usage counts
- valid JSON container types for structured character/template fields
- ownership/relationship foreign keys and indexes

## Migration rule

Do not edit an applied migration in place after a deployed environment exists. Add a new numbered migration instead.

## Next tranche

1. Validate the SQL contract in CI.
2. Add a local Netlify Database test harness without provisioning production resources.
3. Add the first read-only Function (`/api/health` + database connectivity) only after the schema contract is green.
4. Port authentication/session state after database connectivity is deterministic.
