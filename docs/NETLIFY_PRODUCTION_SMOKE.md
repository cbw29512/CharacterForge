# CharacterForge Netlify production smoke

CharacterForge production verification is intentionally separate from deployment.

The repository does **not** automatically deploy when this smoke check runs. The check only verifies a site URL that has already been deployed deliberately.

## Required inputs

- `CHARACTERFORGE_SITE_URL`: exact deployed HTTPS origin
- `CHARACTERFORGE_EXPECTED_SHA`: exact full 40-character Git commit expected in `/build-info.json`

Run locally:

```bash
CHARACTERFORGE_SITE_URL="https://example.netlify.app" \
CHARACTERFORGE_EXPECTED_SHA="0123456789abcdef0123456789abcdef01234567" \
npm run smoke:netlify
```

Or use the manual **CharacterForge Netlify Production Smoke** GitHub workflow and provide the same two values.

## What it proves

The smoke checker fails unless all of these are true:

1. The target uses HTTPS.
2. Requests remain on the supplied origin.
3. `/build-info.json` exists and reports the exact expected commit SHA.
4. The public page returns CharacterForge's required security headers.
5. `/api/health` reports `service: characterforge`, `database: reachable`, and schema version `1`.
6. The health response remains non-cacheable.

The workflow has read-only repository permissions and contains no deploy command, Netlify auth token, or site ID.
