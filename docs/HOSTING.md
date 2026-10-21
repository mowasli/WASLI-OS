# Vercel + Supabase hosting preparation

Prepared for review; **not deployed**. No provider accounts, paid resources or database changes have been created. The source repository is on GitHub; GitHub Pages is not the application host.

## Proposed target

- Vercel runs the complete Next.js application on Node.js 24, with Frankfurt (`fra1`) functions.
- Supabase supplies PostgreSQL and managed email/password sign-in. Proposed database region: Frankfurt (`eu-central-1`) to keep application and data near each other. Confirm region/data-residency requirements before creating either project.
- Use a server-only, verified-TLS Supabase pooler connection for `DATABASE_URL`. Vercel instances use a one-connection pool with finite connection timeouts. The embedded local database is blocked in production.
- Select suitable business plans and confirm current provider pricing, account ownership and spending limits before purchase. No subscription has been purchased or cost approved.
- `vercel.json` disables Git-triggered deployments using Vercel's supported `git.deploymentEnabled` setting. Pushing source must not be treated as launch approval. Vercel's import flow can create an initial deployment: do not click Deploy until the target, settings, database changes and access boundary are approved.

## Implemented authentication boundary

Set `WASLI_AUTH_PROVIDER=supabase`. The existing sign-in form verifies credentials at Supabase's password-token endpoint, then verifies that exact token through `/auth/v1/user`. Confirmed, non-anonymous identities are accepted only when their immutable Supabase user UUID and email match a pre-provisioned `app_users` row with workspace memberships. A matching email alone grants no access. There is no public signup or first-visitor owner setup in managed mode.

The browser receives only an opaque HttpOnly/Secure/SameSite cookie; provider access/refresh tokens and passwords are neither returned nor stored in the app database. The database stores a domain-separated hash of the app session. Managed sessions expire within the provider token lifetime and at most one hour; no refresh token is retained, so users sign in again after expiry. Existing local sessions do not become valid managed sessions. Local passwords and local member provisioning remain disabled in managed mode, even if a stale `ALLOW_LOCAL_AUTH` flag exists.

App logout revokes its own session immediately. Supabase-side revocation/disablement after sign-in can take until this bounded app-session expiry to take effect; workspace membership revocation is checked on each scoped request. MFA-enrolled identities are explicitly refused until an MFA challenge flow is implemented. Provider password recovery, invitations and MFA enrollment are not implemented in this application; an approved operator manages accounts through Supabase. This is not a claim of completed production identity/security assessment.

## Secure environment settings

Set actual values in protected provider/environment settings, never commit them or paste passwords/tokens in chat. Separate preview and production environments and databases.

| Setting | Value / purpose |
|---|---|
| Node.js version | 24.x; also pinned by `.nvmrc` and `package.json` |
| `WASLI_AUTH_PROVIDER` | `supabase` |
| `SUPABASE_URL` | Exact project origin, `https://PROJECT_REF.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Project's `sb_publishable_...` public key; kept server-side here. Secret/service-role and legacy JWT keys are not accepted by this sign-in adapter. |
| `DATABASE_URL` | Approved, least-privilege server database role through Supabase's TLS pooler. Do not expose this value in the browser. |
| `WASLI_APP_ORIGIN` | Exact canonical HTTPS website origin; no path. Set the preview origin separately. |

Remove `ALLOW_LOCAL_AUTH` and `WASLI_DATA_DIR` from hosted settings. Do not set `output: 'export'`, an `out` output directory, or GitHub Pages configuration. Vercel framework preset is Next.js; root directory is repository root; install is `npm ci`; build is `npm run build`; output directory uses the framework default.

Google connectors and research scheduling are optional separate release gates. They remain unconnected/unscheduled until their real credentials, approvals and successful checks exist. Google requires the variables in [GOOGLE_SETUP.md](GOOGLE_SETUP.md), including the encryption key and exact hosted callback. No cron is enabled by this configuration; the future scheduler must use 08:00 Africa/Cairo with DST handling and POST the protected endpoint.

## Database and owner preparation — approval required before execution

1. Review `supabase/migrations/0001_core.sql` through `0006_core_rls.sql` in order. Apply to an isolated staging Supabase database only after explicit approval. Runtime servers and the preflight never apply remote migrations.
2. Keep public user signup off in Supabase. Provision a confirmed, non-anonymous owner identity through the approved account process. No email/invitation has been sent by this preparation.
3. Review [provision-owner.sql](../supabase/hosting/provision-owner.sql). After approval, an authorized operator can run it with psql variables `owner_id`, `owner_email`, `owner_name` against the intended database. It matches `auth.users` by UUID plus confirmed email, stores no local password, and gives that owner the four explicit memberships. The initial file must not be repurposed for ordinary scoped members. There is no automatic identity linking or production seeding.
4. Use an approved server database role with the application's required DML privileges. Server queries enforce membership themselves; a role subject to RLS without a bound Supabase `auth.uid()` will not work. Any server-side RLS bypass must be restricted to protected credentials, reviewed tables and the authenticated server APIs. Never use its credential in a Data API/browser client.
5. Verify actual Supabase RLS policies using owner/editor/viewer, unrelated-user and anonymous identities. Enabling RLS is only a preliminary check. Confirm confidential sessions, integration tokens and cross-workspace records remain inaccessible through the Data API.
6. Production company-profile ingestion requires a separate approved action; managed databases are not automatically seeded with the reference deck.

## Preflight and staged validation

From a trusted checkout with secure environment settings and dependencies installed:

```sh
npm run hosting:check
# Optional, explicitly read-only PostgreSQL checks:
npm run hosting:check -- --database
```

The first command performs offline configuration checks, prints no credential values and fails on missing/unsafe core settings. The second adds a read-only transaction checking connectivity, expected tables, RLS enablement and an owner with four memberships. Neither command applies SQL, creates accounts, verifies policy semantics, tests a real sign-in or deploys anything. A successful report does not grant release approval.

After approval, deploy first to an isolated protected staging target and verify a real Supabase sign-in, sign-out/session expiry, viewer write denial, cross-workspace denial, persistence across function restarts, CSRF origin checks and missing-provider failure handling. Confirm the Vercel build/runtime in its real environment, TLS, secret exclusion, backup/restore, logs, retention, accessibility, usage limits and actual policy semantics. Only then approve the production release. See [DEPLOYMENT.md](DEPLOYMENT.md) for all release gates.

## Current blockers

The workspace has no Vercel project/account credentials, `DATABASE_URL`, `SUPABASE_URL`, or `SUPABASE_PUBLISHABLE_KEY`. No hosted database, Supabase account, user login or Vercel build can be truthfully reported as live. Those settings and approval of the concrete staging target/database operations are required to continue externally. Local fixtures test the provider contract and authorization code; they are not live provider evidence.

Provider references: [Vercel Next.js hosting](https://vercel.com/docs/frameworks/full-stack/nextjs), [Supabase authentication](https://supabase.com/docs/guides/auth), [Supabase connection management](https://supabase.com/docs/guides/database/connecting-to-postgres), and the [official Auth API definition](https://github.com/supabase/auth/blob/master/openapi.yaml).
