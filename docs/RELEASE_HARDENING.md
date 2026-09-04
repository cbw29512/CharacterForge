# Release hardening tracker

CharacterForge stays pre-production until every required gate below is green.

## Closed on `release/public-hardening`

- [x] Remove reusable example database credentials from public setup docs
- [x] Require a unique `SECRET_KEY` of at least 32 characters
- [x] Remove automatic known admin/DM/player account seeding
- [x] First-launch admin setup only
- [x] Normalize account password minimum to 12 characters
- [x] Scope DM NPC edit/delete permissions to ownership/campaign ownership
- [x] Prevent arbitrary campaign assignment during character creation
- [x] Restrict character-sheet visibility to authorized users
- [x] Add authorization/security regression tests
- [x] Add dedicated Letter print stylesheet and printable-sheet regression tests
- [x] Add explicit HttpOnly/SameSite session-cookie defaults
- [x] Add non-breaking browser security headers
- [x] Make Flask debug mode opt-in instead of default-on
- [x] Repair login/setup labeling and keyboard-accessible role selection
- [x] Align first-launch password help text with the backend policy
- [x] Repair wizard AI frontend/backend endpoint and payload contract
- [x] Add global Flask-WTF CSRF protection for forms and same-origin JSON POSTs
- [x] Remove tracked timestamped dependency/wizard backups and ignore `*.bak.*`
- [x] Add rendered Pa11y WCAG CI for first-launch setup and login
- [x] Raise the shared muted-text contrast token after the first rendered WCAG findings
- [x] First-launch setup and login pass rendered WCAG 2 AA on run #36 at `45d4364...`
- [x] Improve admin form labels, table headers, modal semantics, and password-policy text

## Still required before public production

- [ ] Extend browser WCAG checks to authenticated dashboards, builder, campaigns, and character sheets
- [ ] Add mobile/desktop browser smoke and performance checks
- [ ] Add a browser-level print/PDF regression in addition to the source-level print contract
- [ ] Validate production HTTPS cookie configuration (`SESSION_COOKIE_SECURE=true`)
- [ ] Evaluate a Content Security Policy after inline scripts/styles are reduced or nonce support is added
- [ ] Verify deployment/security headers in the eventual production environment
- [ ] Audit/consolidate historical PowerShell patch/install tooling
- [ ] Require the release CI gate before `main` can change

Do not deploy or merge the hardening PR until the applicable release gates are green.
