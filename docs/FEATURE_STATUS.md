# Feature status — 21 October 2026

This is an incremental local release. “Implemented and tested” identifies the tested scope below, not production completion. No simulated business feed ships.

| Feature | Status | Evidence / boundary |
|---|---|---|
| Official WASL and THV branding; four workspaces | Implemented and tested | Asset provenance hashes; actual browser workspace switches/logo checks |
| Local owner setup, sign-in/out, sessions | Implemented and tested | Password/session/CSRF tests; browser signup/logout/login |
| Workspace roles and server isolation | Implemented and tested | Object-ID denial, viewer write denial, revocation and cross-scope link tests |
| Global executive dashboard | Implemented and tested | Actual persisted task/project metadata only; descriptions/documents excluded |
| Task create/edit/delete, completion, assignment fields | Implemented and tested | Real CRUD, role denial, reload persistence, browser editing |
| Priorities, tags, dates, estimates, dependencies | Implemented and tested | Validation, acyclic links, prerequisite-completion checks |
| Projects, objectives, milestones, progress/risk | Implemented and tested | Real linked records; milestone and project editing in browser |
| List/Kanban/calendar/search | Implemented and tested | Desktop critical browser workflow; keyboard/select alternatives to drag |
| Mobile and RTL primary navigation | Implemented and tested | 390px browser viewport, RTL/no horizontal overflow; screenshots |
| Full Arabic interface translation | Planned | Primary navigation and RTL exist; specialist/form translation incomplete |
| Scoped assistant interface and private history | Implemented and tested | Rules-based summaries of actual records; user+workspace history isolation |
| Company-profile search and cited answers | Implemented and tested | Raw 13-slide text and original hash; lexical search; no cross-company retrieval |
| External language-model reasoning, tool calls, semantic RAG | Planned | No model connection or external proprietary-data sharing configured; code beyond rules-based assistant remains planned |
| Google OAuth/PKCE/encrypted credentials | Implemented and tested | Controlled 14-test security suite; no real account connected |
| Google live consent and read APIs | Requires backend configuration | Google client, callback and encryption configuration missing; real consent/API reads unrun |
| Drive Picker/content ingestion/permission-change sync | Planned | Current foundation restricts metadata to selected app-authorized IDs |
| Email bodies/task extraction/approved event writes | Planned | Current Gmail connector lists authorized message IDs; Calendar read endpoint authored, live unverified |
| Manual official-source research and persistence | Implemented and tested | Authentic World Bank scans and dedup; bounded two-query coverage; expired calls remain expired |
| Opportunity scoring/eligibility gate | Implemented and tested | Transparent rules-based 25/20/20/15/10/10 weights; unknown eligibility never Apply |
| Research save/tags/notes/comments/archive | Implemented and tested | Persisted, role-scoped, archive concurrency regression |
| Opportunity-to-research-project conversion | Implemented and tested | Atomic/idempotent actual project; no application or outreach implied |
| Editable scoring weights in interface | Planned | Exported function accepts custom validated weights; UI/persisted preference not implemented |
| Daily research endpoint/job logs/retry/dedup | Implemented and tested | Protected cron route, failure handling, source provenance; manual execution tested |
| Deployed daily 08:00 Africa/Cairo schedule | Requires deployment | No hosted schedule exists; source code never claims one |
| Experts, competitor discovery, APPLY WITH X | Planned | No invented expert/partner profiles or uncited consortium recommendations |
| Reading center/program design/strategy agents | Planned | Full specialist agents not implemented |
| THV SOP drafts/revisions/owner approval/archive | Implemented and tested | Immutable approved versions, stale approval409, scoped persisted records |
| THV portfolio/contact records | Implemented and tested | Genuine typed CRUD; no fictional startup seeding |
| Personal contacts/content plans | Implemented and tested | Actual scoped records; no publishing/external outreach |
| Freelance/volunteer engagements | Implemented and tested | Independent categories and shared PM; no full invoicing/accounting |
| JSON export/offline backup and restore | Implemented and tested | Scoped task/project/audit export; actual restore drill; private snapshots |
| Managed Supabase/PostgreSQL schema/RLS | Requires user authorization | SQL supplied and unapplied; actual hosted identity/policy tests unrun |
| Managed Supabase sign-in and bounded app sessions | Implemented; controlled tests pass | Provider token verification, provisioned UUID membership, domain-separated sessions, MFA refusal and expiry; real account/login unverified |
| Vercel + Supabase hosting configuration/preflight | Prepared; local checks tested | Production embedded-storage guard, pooler limits, secure environment handoff, manual owner SQL; no provider project or credentials configured |
| Hosted encrypted infrastructure, RLS policy validation, disaster recovery | Requires provider configuration and authorization | Actual managed infrastructure and production policy/restore checks remain unrun |
| External deployment | Requires user authorization | Source pushed to GitHub; no public app URL or production migration performed |
| Oversized Brand Assets/Filing archives | Blocked | Each exceeds 32 MiB transfer limit; company deck supplied verified usable assets |

# Master acceptance scenarios

| Test | Result |
|---|---|
| 1 Task persistence | Passed local browser reload and PostgreSQL reopen |
| 2 Workspace isolation | Passed application-level task/document/history denial; hosted RLS still unrun |
| 3 Project management | Passed local linked tasks/milestones/dependencies/progress/risk behavior |
| 4 Authorized calendar event→task | Pending real Google consent and linking feature |
| 5 Authorized email→approved task | Pending real Google consent and extraction/approval workflow |
| 6 Daily intelligence | Manual real scan passed; deployed scheduled run pending, so full scenario not passed |
| 7 Opportunity deduplication | Passed repeated official scans and database tests |
| 8 APPLY WITH X | Planned; not passed |
| 9 Expert matching | Planned; not passed |
| 10 Company Brain | Passed raw approved profile lexical retrieval/citations; model/Drive semantic retrieval pending |
| 11 THV SOP | Passed real persistence/version/approval tests; browser scenario recorded in implementation log |
| 12 Executive briefing | Task/project snapshot works; full calendar/email/intelligence briefing pending |
| 13 Branding | Passed official asset provenance and visible WASL/THV logo checks |
| 14 Mobile | Passed core 390px RTL workflow; complete specialist/mobile accessibility review pending |
| 15 Failure handling | Missing config/browser errors and expired/revoked provider fixtures pass; real Google expiry/revocation unrun |
