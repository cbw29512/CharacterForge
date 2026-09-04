# Security Policy

CharacterForge is currently in active development and is not yet certified for public production deployment.

## Reporting a security issue

Please avoid posting credentials, tokens, private user data, or exploitable details in public issues. Use the repository owner's private contact channel when available.

## Deployment expectations

- Never deploy with example or default credentials.
- `SECRET_KEY` must be a long, unique secret supplied through the deployment environment.
- Production database credentials must be supplied through environment configuration and must not be committed to the repository.
- Local development credentials must not be reused in production.
- Public release requires authentication/authorization tests, dependency/secret scanning, security-header checks, and production smoke tests.
