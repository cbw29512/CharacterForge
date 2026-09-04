# CharacterForge deliberate Netlify deploy checklist

Use this only when CharacterForge is ready for an intentional Netlify deployment.

1. Confirm the candidate Git commit is fully green in CharacterForge Netlify Schema, Netlify Frontend, Security Smoke, and History Secret Scan.
2. Deploy that exact commit deliberately through the configured Netlify project.
3. Record the exact deployed HTTPS site URL and full 40-character Git SHA.
4. Run **CharacterForge Netlify Production Smoke** manually with those two values.
5. Require a green smoke result before treating the deploy as production-ready.
6. If the smoke reports a SHA mismatch, security-header failure, or database/schema failure, do not promote the deployment.

The smoke workflow verifies an existing deployment only. It does not create, update, retry, or promote a deployment.
