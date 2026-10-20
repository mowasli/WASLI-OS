# WASLI OS

A private executive workspace built with Next.js, TypeScript and PostgreSQL. Phase 1 implements the common project/task engine first; specialist workflows have explicit implementation statuses.

## Run locally

Requires Node.js24. From this checkout:

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

Open the application on port3000 and create the first owner account. Use a unique password. The local account belongs to four distinct workspaces. No task, project, deadline, intelligence or business metric is fabricated. Account and workspace records persist under `.data/wasli` across browser reloads and server restarts. Keep this directory private and backed up. Run exactly one application process per local data directory.

`npm run build` verifies a production compilation. Local password authentication intentionally fails closed in production mode unless `ALLOW_LOCAL_AUTH=true` is explicitly set for a private validation environment. It is not a production identity configuration.

## Validate

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
# Optional live official-source browser validation:
WASLI_VERIFY_LIVE=true npm run test:e2e
```

Browser tests use Chromium and a separate disposable database; see playwright.config.ts. The live-source scenario is explicitly skipped unless WASLI_VERIFY_LIVE=true; it uses real public endpoints and can fail on source/network availability. Captured test fixtures are not live research or user operational records.

## Security and deployment

Server APIs enforce workspace membership and role. Sessions use hashed opaque tokens and HttpOnly same-site cookies; passwords use scrypt. Google accounts and scoped document retrieval remain separate per workspace. Never expose `.data`, secrets or backups. The local database is not encrypted at rest; use encrypted managed storage and an approved production identity provider before handling production confidential information.

Do not run against production `DATABASE_URL` until migrations, RLS, identity and backups have been reviewed and approved. No external deployment or production migration has been performed. Review [PLANS.md](PLANS.md), [requirements](docs/REQUIREMENTS.md), [brand audit](docs/BRAND_SOURCES.md) and [implementation log](docs/IMPLEMENTATION_LOG.md).

See [feature status and acceptance scenarios](docs/FEATURE_STATUS.md) for tested scope and outstanding product work.
