# WASL intelligence: evidence, execution and release gates

## Current capability and limitations

This is an implemented local research pipeline with real persistent PostgreSQL records and job logs. It contains **no seeded opportunities**, fake budgets, fake organizations or fake source links. A local/manual request performs actual public-source retrieval; a denied request is a failed job and HTTP 502, not a successful scan. Unit/integration transport fixtures live only in `tests/intelligence.test.ts` and are expressly synthetic.

**Live official-source retrieval and deduplication are verified.** On 20 October 2026, source-scoped `undici.fetch` plus `EnvHttpProxyAgent` successfully retrieved HTTP 200 responses from the World Bank procurement API. Initial native-fetch and policy failures were diagnosed; the working transport honors the supplied proxy and never falls back to direct networking. The parser was corrected against the real response schema (`project_ctry_name`, `bid_description`, `submission_deadline_date`, `contact_organization`, and `noticedate` in `DD-Mon-YYYY`).

A final isolated persisted scan discovered **9 actual Yemen/MENA procurement calls**, all with past source-supplied deadlines. **None are represented as currently open or eligible.** Contract awards, canceled and closed notices are excluded. The second scan fetched the same 9 notices and inserted **0 duplicates**, with 0 fact changes. The entrepreneurship query succeeded but returned 0 MENA calls in its first 50 records. The application database was not populated by these isolated CLI validation runs; use the authenticated Manual Scan control to fetch into it.

Final validated scan IDs in `.data/research-validation-current`: `3e9e502e-bfb3-4a72-bcd6-bf3a47cb2070` (9 discovered), `9a114021-92f0-4959-bd91-60dcbed794a5` (0 discovered, 0 updated). An earlier diagnostic database retains pre-filter records for audit; it is not the application data directory and must not be used as its seed.

Sources configured for the first connector:

- World Bank public procurement search API, Yemen query: `https://search.worldbank.org/api/v2/procnotices?format=json&rows=50&os=0&qterm=Yemen`.
- Same official API, entrepreneurship query, filtered to MENA countries in parsed results.
- UNDP procurement was probed for availability but is **not enabled or implemented as a connector**.

Coverage is deliberately bounded to those two official API searches, at most 50 returned notices each. This is not comprehensive MENA procurement discovery. Government, donor, NGO, expert, competitor and research-library discovery connectors remain pending. The final 50-record source response was inspected, including notice types and date ordering. Pagination and broader-country discovery remain pending; there is no completeness claim.

## Data and trust

`supabase/migrations/0002_intelligence.sql` adds:

- `intelligence_sources`: configured endpoints, enabled flag, last attempt, last success and error.
- `intelligence_records`: stable source ID, source-supplied title/country/buyer/text/date fields, exact response URL or safe source-supplied notice URL, content hash, last retrieval, lifecycle/verification state, score dimensions and weights, provenance.
- `intelligence_jobs`: trigger, running/succeeded/partial/failed state, start/end, per-source attempt counts/errors and discovered/updated counts.
- `intelligence_comments`: immutable author-attributed workspace comments. Saved state, tags, private notes and a research-project link live on records, separate from scanner-owned source facts.

A response with an unrecognized schema fails rather than generating fallback records. Missing or ambiguous deadlines remain null. Eligibility stays `unknown` until verified outside this automated extraction; source retrieval does not establish eligibility, price, delivery feasibility or an open application. Contract awards/canceled/closed source notices are excluded. Calls whose source-supplied deadline is past are marked expired. No model sees source text in this pipeline, and no retrieved instruction is executed. React consumers must render source strings as text, never HTML.

Source URLs must use HTTPS, approved exact World Bank hosts, no URL credentials and no nonstandard port. Redirects are rejected. Requests have a 20-second timeout and a 2 MB streamed response limit. The scanner never accepts a user-provided URL. Public source requests contain only public query terms, not workspace records or proprietary material.

A missing per-notice URL cites the exact official JSON endpoint containing the source record. The application does not invent a plausible notice path. The `lastVerifiedAt` field records **retrieval time**, and the adjacent verification note makes clear that mandatory eligibility and dates still require review.

## Scoring and eligibility

The score is explicitly a **rules-based heuristic**, not an AI opinion or a verified qualification:

| Dimension | Default weight |
| --- | ---: |
| WASL capability keyword fit | 25% |
| Strategic importance / priority markets | 20% |
| Commercial / partnership potential | 20% |
| Qualification and delivery feasibility | 15% |
| Deadline urgency | 10% |
| Partnership / ecosystem value | 10% |

The exported scoring function accepts alternative nonnegative weights summing to 100 and validates all dimensions in 0–100. Default commercial and feasibility estimates are conservative assumptions, preserved alongside provenance; they are not verified source facts. UI configuration and richer evidence-based evaluation remain pending.

An expired or ineligible notice always yields **Pass**. Unknown eligibility can yield only **Explore** or **Monitor**, regardless of attractiveness. **Apply** requires explicit eligible status and a score of at least 70. The current automated parser never marks a notice eligible.

## Isolation, idempotency and resilience

Only a user with WASL membership can read results. Only a WASL owner/editor can manually scan. Other workspaces are rejected. The API applies same-origin mutation checks and server-side role authorization. Global dashboards do not return these records. RLS is enabled on intelligence tables; Supabase-compatible read policies use workspace membership when the `auth` schema is present. No browser table grants or write policy are installed by this migration.

Records deduplicate on `(workspace_id, external_id)` across queries. Same-content scans refresh retrieval metadata. Changed facts update the existing record. Archived records remain archived. A database unique partial index permits only one running WASL scan, and a job older than 30 minutes has its lease marked failed. Source failures persist; one transient retry is allowed. Nonretryable authorization/schema/allowlist/size errors are not repeatedly retried. Partial success is distinct from all-source failure.

User curation is implemented and tested: save/unsave, tags, private notes, append-only comments, archive and restore. The API derives comment authors from the authenticated account and returns the latest 20 comments per record. The source scanner does not overwrite curated fields or resurrect archived notices. Restoring a record with a past deadline leaves it **expired**, preserving source currentness.

A user-authorized **Research project** conversion creates a genuine WASL project through the shared PM engine. It locks the notice, creates the project and writes the linkage/audit in one transaction. Repeated and concurrent conversion requests return the same project. The project title begins `Research:` and its description explicitly states that it is not an application, eligibility determination, outreach or external commitment. No submission deadline is copied into its project due date. A composite foreign key prevents linking THV projects; deleting the linked project clears the link without deleting research evidence. Only WASL owner/editor roles can curate or convert. Evidence-backed APPLY WITH X remains pending.

## Local execution

From `/workspace/WASLI-OS`:

```sh
npx tsx scripts/scan.ts
npx tsx --test tests/intelligence.test.ts
```

Use the authenticated WASL Intelligence panel for concurrent development; do not run a second process against the same PGlite data directory while the Next server is using it. A CLI scan exits nonzero if all sources fail. It refuses managed database execution unless the operator has explicitly authorized deployment and set `WASLI_ALLOW_MANAGED_JOB=true`.

The local loader applies migration 0002 only when `DATABASE_URL` is absent. With a managed database, it checks that approved migration tables exist and does not run DDL or seed tables automatically.

API:

- `GET /api/intelligence?workspace=wasl`: persisted records, sources, jobs, score weights and schedule state.
- `POST /api/intelligence/scan` with `{ "workspaceId": "wasl" }`: authenticated same-origin manual scan.
- `GET /api/intelligence/[id]`: one WASL record with curated fields and latest comments.
- `PATCH /api/intelligence/[id]`: strict optional `{saved:boolean,tags:string[],notes:string,status:"archived"|"unverified",comment:string}`; at least one field required. `comment` appends a server-attributed comment; it cannot replace another author's comment.
- `POST /api/intelligence/[id]/convert` with `{}`: idempotent research-project creation; returns `{project,created}`, HTTP 201 on creation or 200 when already linked.
- `POST /api/jobs/intelligence`: server scheduler endpoint, requiring exact `Authorization: Bearer …` matching server-only `WASLI_CRON_SECRET` of at least 32 characters. Missing configuration returns 503, bad authorization returns 401, all-source failure returns 502.

## Deployment and daily scheduling: not active

**No daily job is deployed.** `schedule.status` is always `not_deployed` until an operator-approved deployed scheduler has been configured and independently verified. A configured token alone is not evidence of scheduling.

The requested default is 08:00 in `Africa/Cairo`. Use a scheduler with IANA timezone support (for example an approved Google Cloud Scheduler job). Cairo observes seasonal time changes; do not hardcode one UTC cron hour for all dates. Configure a daily `0 8 * * *` job with timezone `Africa/Cairo`, HTTP POST to the production `/api/jobs/intelligence` endpoint, a secret-manager-backed Authorization header, bounded retries and failure alerts. The app must use managed PostgreSQL on a durable host; a filesystem PGlite directory on a serverless deployment is not production persistence.

Before deployment, obtain user approval for the concrete hosting/scheduler/database plan, apply reviewed migrations, configure HTTPS and secrets, allow official source domains, validate a manual live scan, verify at least one actual scheduled execution and confirm its source URLs, timestamps, deduplication and job logs. Only then change the operational status and make a daily-feed claim.

## Test evidence

Seven tests pass locally:

1. Required/default and configurable weighted score math.
2. Eligibility and expiration gates overriding attractiveness.
3. SSRF/host/port/credentials/redirect and response-size rejection.
4. Missing dates, unknown eligibility, MENA and contract-award filtering, official date-field parsing, schema rejection and inert prompt-injection text.
5. Exact constant-time scheduler bearer authentication and missing-secret denial.
6. Actual PostgreSQL reopen persistence, same-ID dedup, changed record update, archive preservation, failed source/job logs, and successful transport-fixture job completion.
7. Viewer/other-workspace denial, strict curation validation, server-attributed comments, saved/tag/note/comment persistence after reopen, archive survival through rescans, expired-state preservation on restore, concurrent idempotent research-project conversion, database rejection of cross-workspace project links, audit records, and safe project-deletion unlinking.

These tests establish implementation behavior with synthetic test inputs. Separate live-source validation establishes official response availability and parser compatibility for the configured World Bank queries, and repeated live scans establish deduplication. Neither the tests nor the manual live runs establish deployed scheduling, currently open/eligible opportunities, broader MENA coverage or production readiness.
