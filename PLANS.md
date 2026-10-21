# WASLI OS implementation plan

## Architecture and decisions
Next.js App Router / React / strict TypeScript provides the responsive application and authenticated server routes. The shared project/task engine uses parameterized PostgreSQL queries. Local development uses a persistent PGlite PostgreSQL database under ignored `.data/wasli`; one Node server owns it. PGlite is a local PostgreSQL runtime, not a managed database or production multi-instance storage. `DATABASE_URL` selects verified-TLS PostgreSQL (including a Supabase connection) after operator-approved migrations. No production database changes are automatic.

Authentication uses scrypt password hashes and opaque, hashed, expiring HttpOnly sessions for local development. A first local owner creates the initial account and four memberships. In managed mode, Supabase verifies credentials and the exact access token; a pre-provisioned UUID/email and memberships are required. Public owner setup and local account creation are disabled. Managed app sessions expire within one hour/provider expiry, and local session hashes are isolated from managed sessions. Local owners may provision scoped members; hosted account provisioning is an approved operator action. Editors can modify workspace records and viewers cannot. Real provider login, hosted RLS tests and the production identity security review remain release gates.

Every server route checks membership and role. Global aggregation returns limited metadata, not workspace documents/research. Workspace-scoped assistant history, knowledge, research sources and Google accounts cannot bleed across company boundaries. OAuth tokens use AES-GCM encryption; consent/state binds the user, session and workspace. Retrieved text cannot authorize actions. External effects always require the user's approval.

UI uses official supplied WASL and THV assets with recorded provenance. WASL royal blue/ink/brand North Star, THV dark green, a quiet warm Personal office, and hot-orange Independent work share an accessible data engine. Local Poppins and IBM Plex Sans Arabic support English/Arabic and RTL. No artificial operational records are seeded.

## Phases and acceptance gates

| Phase | Scope | Acceptance gate | Progress |
|---|---|---|---|
| 0 | Full prompt/reference audit, source map, asset extraction, architecture | Requirements traceable to master; actual logos/colors identified; limitations recorded | Audit and architecture completed; two large archives unavailable |
| 1 | Auth, four workspaces, executive overview, project/task CRUD, search, Kanban, calendar, scoped basic assistant | Task survives reload/restart; role/isolation denial tests; desktop/mobile browser flows; production build | Implemented and tested locally; hosted release gates remain |
| 2 | Google OAuth, scoped read connectors, controlled ingestion and approval | Real consent/retrieval; expired token/replay handling; no unapproved sends/indexing | OAuth/read-only foundation and 14 security tests complete; live credentials and indexing/sync remain unavailable |
| 3 | Real-source opportunities ingestion, dedup, transparent scoring, jobs/logs, knowledge citations; later experts/competitors/APPLY WITH X | Successful authentic source scan; verified dedup; deployed daily run at 08:00 Africa/Cairo; cited evidence | Real manual World Bank retrieval/dedup/curation/conversion tested; daily deployment and broader agents pending |
| 4 | THV Softlanding then Venture Building SOP/version approvals/portfolio | Create/edit/version/approve SOP; operational lifecycle evidence | SOP/version/approval + portfolio/contact foundations tested; lifecycle automation pending |
| 5 | Personal branding/relationships, independent clients/invoices/volunteer CRM | Real persisted scoped domain workflows | Shared PM + contacts/content/engagement foundations tested; advanced specialist modules planned |
| 6 | Identity, backups, hardening, UAT, performance, approved external deployment | Production security review, restore drill, Google/cron live tests, user authorization | Vercel/Supabase preparation and managed identity code tested with controlled fixtures; live identity/RLS, account configuration and approved hosting remain pending |

## Dependencies and constraints
- Node.js24 (validated with 24.19.0); `npm ci --cache /workspace/.npm-cache`.
- Supabase/PostgreSQL credentials and approved schema changes required for hosted production persistence.
- Hosting target selected for preparation: Vercel Node.js 24 plus Supabase PostgreSQL/Auth; Frankfurt region is proposed and unprovisioned. See docs/HOSTING.md. Required core settings are WASLI_AUTH_PROVIDER, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, DATABASE_URL and WASLI_APP_ORIGIN. Git-triggered Vercel deployment is disabled; no account credentials are present.
- Google OAuth client, HTTPS callback and a server encryption key required for live connections. Platform `GOOGLE_APPLICATION_CREDENTIALS` is not assumed to authorize access to the user's Google Workspace.
- No configured language-model API: assistant is explicitly rules-based, backed by actual local records and exact document citations.
- Official research/API network destinations must be applied in environment settings. Draft saving does not activate networking or schedule jobs.
- Two supplied ZIPs exceed the 32 MiB transfer limit; their contents are uninspected. The available company deck is the verified source, and starter-kit example company is fictional.
- No external deployment, production migration, sharing or irreversible operation without explicit approval.

## Validation strategy
Meaningful unit/integration tests use disposable PostgreSQL directories, including persistent reopen, auth/session, membership denial, cross-workspace links, dependency cycles, source dedup/scoring/eligibility, OAuth state/crypto and scoped knowledge. Browser tests exercise actual signup, project/task create/edit/delete, reload persistence, view transitions and mobile/RTL. Production build/typecheck must pass. Real-source and live-provider checks remain distinct from controlled fixtures. See docs/IMPLEMENTATION_LOG.md for recorded results, never infer tests passed from this plan.

## GitHub Actions repair

The added GitHub Pages sample workflow used Node.js 20 and forced a static export. A disposable Node.js 20 build reproduced a failure collecting `/api/intelligence` because the locked Undici dependency requires a newer runtime. Pages also cannot host the application's authenticated server routes or PostgreSQL access. Initial repair consolidated validation in `ci.yml`, using `.nvmrc` (24), checkout/setup-node v6, Ubuntu 24.04 and generated Next.js route types before typecheck. After commit `dc503cb` restored the Pages template, moved the working validation configuration to `nextjs.yml` and removed the duplicate `ci.yml`. There is now one server build/test workflow, with no Pages deployment. Deployment remains a separate approved milestone on a host supporting Next.js server routes; no static replacement of the application is planned.
