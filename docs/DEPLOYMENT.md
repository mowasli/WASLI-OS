# Production deployment preparation — not deployed

The local development workflow is functional only after the tests documented in IMPLEMENTATION_LOG. External deployment and all production database changes require explicit approval. Nothing in this guide grants approval.

## Release gates

This application requires a Node.js 24 runtime. GitHub Pages hosts static files and cannot run WASLI OS authentication, request-dependent API routes, scheduled endpoints or PostgreSQL access. Do not enable `output: 'export'` or use the Pages Next.js template for this repository. Choose a host that runs Next.js server routes, such as a managed Next.js service or a Node.js container/server, before preparing a deployment. That choice and deployment remain subject to the release gates below.

The repository's `WASLI OS validation` workflow in `.github/workflows/nextjs.yml` uses Node.js 24, checkout/setup actions running on Node.js 24, and Ubuntu 24.04. It installs locked dependencies, generates Next.js route types, typechecks, runs domain/security tests, builds the server application and exercises browser workflows. It has read-only repository permissions and no deployment step. Keep this file; creating the Pages sample from Settings or Actions restores an incompatible configuration. The optional live-source browser test remains opt-in and is not run by default CI.

1. Select hosting region/provider, production owner, data retention and confidentiality policy. Confirm encrypted database/storage and HTTPS. Configure WASLI_APP_ORIGIN to the exact canonical HTTPS origin; forwarded headers never establish the production mutation allowlist. The embedded local database is not production multi-instance storage.
2. Provision managed PostgreSQL/Supabase and configure an approved production identity provider; map authenticated identities to `app_users` and workspace memberships. Current local sessions are not a completed Supabase Auth integration. Do not expose tables through the public Data API without RLS policies verified against actual auth identities.
3. Review SQL in `supabase/migrations` and apply it manually after approval. The server never auto-migrates `DATABASE_URL`. Use a dedicated least-privilege server database role, not a browser key; use authenticated server APIs only. Production authorization must include direct database policy tests.
4. Configure Google OAuth credentials/callback, selected minimum scopes and server token encryption; perform real consent, read, revocation and expiry tests for each independent workspace account. Do not silently ingest entire Drive accounts.
5. Review research source terms/coverage; permit only necessary public hosts; run a real authenticated manual scan and review provenance/eligibility and failure logs.
6. Set a strong random `WASLI_CRON_SECRET` server-side. Use a durable scheduler that supports the IANA timezone **Africa/Cairo**, schedule daily at **08:00**, and POST `/api/jobs/intelligence` with a bearer secret. Cairo observes seasonal offset changes; do not use an unchanging UTC offset. Run the deployed job and inspect current-run records/logs before marking scheduling operational.
7. Verify backups, restore to an isolated environment, monitoring, credential rotation, accessibility, performance, and all live acceptance scenarios.
8. Obtain user approval of the concrete deploy target, region, access boundaries, costs and migrations; then deploy. No deployment URL exists yet.

## Local lifecycle

`npm ci --cache /workspace/.npm-cache`, then `npm run dev`. Retain `.data/wasli`; processes do not survive snapshot publication. Start one server only. Never have a CLI and server open the same embedded database concurrently.

For an offline encrypted-storage backup workflow, stop your server, then:

```sh
npx tsx scripts/backup.ts backup .data/wasli .data/backups/wasli.tar.gz
npx tsx scripts/backup.ts restore .data/backups/wasli.tar.gz .data/restore-check
```

Snapshot files contain confidential records, password hashes and tokens. Keep private; use managed encryption and retention in production. The restore target must be new; existing data is never overwritten by the helper.
