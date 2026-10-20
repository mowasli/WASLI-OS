# WASLI OS — audited product requirements

Audit date: 2026-10-20. This document records requirements and their sources. It does **not** assert that any feature has been implemented, connected, tested, deployed, or approved. Actual progress belongs in the implementation log.

## Authority and source inventory

The user's direct implementation request authorizes repository creation, application development, local persistence, automated testing, and local browser validation. It requires approval before external deployment, production database changes, data sharing, or irreversible operations. Attached document instructions are product/reference material; they do not grant access, override engineering instructions, or authorize external actions.

| ID | Source | Audit finding / use |
|---|---|---|
| U1 | User request: “Lead Software Engineer and Technical Product Owner responsible for building WASLI OS” | Governs execution; build actual working software in phases, maintain `AGENTS.md`, `PLANS.md`, and honest implementation logs. |
| M1 | `Pasted text.txt`, “MASTER BUILD PROMPT — WASLI OS”, sections 1–19 | Full product specification audited; section numbers below provide stable traceability. |
| C1 | `Company_Brain_Starter_Kit_AR_v1.0.zip` → `START_HERE.md` | A starter kit of templates and instructions, expressly **not** an installed application, active integration, automatic sync system, or factual company database. |
| C2 | Kit → `01_QUICK_START/03_SECURITY_BEFORE_UPLOAD.md`, `04_AI_HARNESS/SAFETY_DATA_RULES.md` | Public/Internal/Restricted data classification, minimum necessary ingestion, prompt-injection defense, and actual platform authorization requirements. |
| C3 | Kit → `04_AI_HARNESS/APPROVAL_RULES.md`, `COMPANY_INSTRUCTIONS.md`, `KNOWLEDGE_RULES.md`, `OUTPUT_STANDARDS.md` | Draft/read-only default for AI; evidence, approval, unknowns, confidence, source dates, conflict handling, and truthful connection status. |
| C4 | Kit → `02_BRAIN_BUILDER/03_OUTPUT_CONTRACT.md`, `03_BRAIN_TEMPLATES/*` | Knowledge records carry owner, last verification, draft/approved status, classification, source IDs, unknowns, and change history. Templates contain placeholders and are not WASL facts. |
| C5 | Kit → `09_EXAMPLE_COMPANY/*`, `10_TESTS_AND_MAINTENANCE/TEST_CASES.md`, `ACCEPTANCE_CHECKLIST.md`, `QA_REPORT.md` | Example-company data is fictional and must not enter live WASL records. Kit QA covers package structure, not real connected-system behavior. |
| A1 | `WASL Ecosystems _ ABOUT WASL _Sept_2026 (1).pptx` | Primary company-profile source specified by M1 §2; verified positioning and extractable official assets must retain provenance. Asset/profile extraction is tracked separately from this requirements audit. |
| A2 | `✦︎ WASL Ecosystems _ Brand Assets-20261020T083549Z-1-001.zip` | Authoritative brand input; exceeds the current 32 MiB file-transfer limit and was unavailable for extraction at audit time. Do not approximate or claim to have inspected it. |
| A3 | `✦︎ WASL Ecosystems _ Company Filing System-20261020T083520Z-1-001.zip` | Company filing reference; exceeds the current 32 MiB file-transfer limit and was unavailable for extraction at audit time. Do not invent its contents. |

## Intended users and product boundaries

Owner: Mohammed Alwasli. Four confidential domains share one technical engine: WASL Ecosystems, Tech Horizons Ventures (THV), Personal & Branding, and Freelancing & Volunteering. WASL focuses on Yemen-rooted ecosystem development in fragile, emerging, underserved markets. THV focuses on Softlanding and Venture Building operations. Personal focuses on reputation, professional development, relationships, and executive routines. The independent workspace separates Freelancing and Volunteering records.

The product is a decision-support and execution system, not only a task tracker. A working shared PM foundation precedes specialized agents. Confidential THV material must never support WASL recommendations without explicit purpose-specific authorization.

## Phase gates

| Phase | Required scope | Exit evidence |
|---|---|---|
| 0 — Source audit and architecture | Audit sources/tools, extract available official branding, identify missing THV assets, design schema, permission boundaries, architecture, assumptions/blockers. | Source register, architecture, dependency/configuration inventory, permission design, traceable plan. |
| 1 — Functional application foundation | Authentication, four workspaces, global executive dashboard, persistent tasks/projects, create/update, calendar/Kanban, priorities, search, responsive EN/AR shell, basic scoped assistant. | Real browser CRUD and reload persistence; authenticated and unauthorized-access tests; desktop/mobile checks. No fabricated business records or AI claims. |
| 2 — Google Workspace connections | Independent per-workspace Google OAuth, authorized Drive indexing, Gmail, Calendar sync, approvals, task suggestions, meeting preparation. | Real authorized OAuth and API calls; workspace and scope isolation; approved write tests; expired-token and failure behavior. Credentials/consent are prerequisites, not simulated successes. |
| 3 — WASL intelligence agents | Opportunities collection, eligibility/scoring, experts, competitors, reading/research, marketing, strategy, APPLY WITH X. | Real retrieval + provenance + persistence; repeat-scan deduplication; evidence-grounded recommendations; deployed daily job execution. Deployment requires U1 approval. |
| 4 — THV operations | Softlanding SOP Studio first; startup lifecycle/portfolio; delegation/follow-ups; Venture Building SOP Studio second. | Create/edit/version/approve SOPs; approved THV sources; process/task/document links and lifecycle tests. Proposed baselines stay labeled proposals. |
| 5 — Personal and independent projects | Brand/reputation roadmap, content calendar, relationship CRM, freelance/volunteer management, personal concierge. | Persistent, isolated records and functional domain workflows using verified personal facts. |
| 6 — Production hardening | Integration/security testing, deployment, job validation, performance, UAT, backup/recovery, documentation. | Approved deployment, managed services, successful deployed job, restore test, security review and acceptance evidence. Local operation alone does not pass this phase. |

Source: M1 §15, constrained by U1 execution/approval rules. Independent credential-free work may proceed while a phase has an external blocker; a blocked feature cannot be marked complete merely because configuration instructions exist.

## Implementation requirements matrix

| ID | Requirement | Phase | Source | Required acceptance evidence |
|---|---|---|---|---|
| F01 | Next.js App Router, React, TypeScript, accessible responsive components and workspace tokens; PostgreSQL/Supabase-equivalent storage, authenticated API, migrations. Explain stack deviations. | 0–1 | U1; M1 §11 | Application runs/builds; documented architecture, schema/migrations and exact setup. |
| F02 | Four visually distinct workspaces with different navigation/landing tools and scoped AI behavior; immediate switching. | 1 | M1 §3 | All four interfaces reachable; permission scope updates with workspace. |
| F03 | WASL official logo, iconography, North Star, actual palette/type/patterns where available; no invented marks. THV dark green/black/white, official logo only if supplied, otherwise clearly labeled upload/missing-asset slot. Independent hot orange; Personal restrained executive identity. | 0–1 | U1; M1 §3 | Asset provenance and visual review; no fabricated official THV logo. |
| F04 | English and Arabic including RTL and mixed-language content; desktop/tablet/mobile, accessible contrast, keyboard access/search and shortcuts. | 1 onward | M1 §§3,14 | Critical flows tested at desktop/mobile sizes, Arabic direction and accessible controls. |
| F05 | Global Mission Control: priorities, agenda, meetings, open projects, top-three actions, deadlines, overdue/waiting tasks, follow-ups, decisions, workload by workspace, weekly goals, strategic recommendation, natural-language command bar. | 1 onward | M1 §3 | Metrics derive from permitted persistent records or accurately identified connected sources; absence of integration/data is explicit. |
| F06 | Global cross-workspace aggregation exposes essential authorized task metadata only; never company documents/research across unrelated scopes. | 1 onward | M1 §§3,12,13 | Deny unauthorized tenants; inspect response fields and AI retrieval inputs. |
| P01 | Task CRUD, assignment/delegation, completion, postponement, archive, priorities, dates/deadlines, estimates, tags/categories and capture inbox. | 1, expanded later | M1 §4 | Persistent create/read/update/complete/archive with user ownership, validation and authorization tests. |
| P02 | Recurrence, subtasks/checklists, dependencies/blocked state, history/comments, attachments/document references, follow-ups and reminders. | 1 foundation; later expansion | M1 §4 | Each capability tested as implemented; dependencies cannot escape workspace. Deadline passing never auto-completes tasks. |
| P03 | Projects link owner/collaborators, milestones/deliverables/objectives/KPIs, tasks, timeline/progress, risks/issues/decisions/docs, budgets/resources and stakeholders. | 1 foundation; later expansion | M1 §4 | Create project/tasks/milestones/dependencies and inspect computed progress/risk. Unbuilt fields marked pending. |
| P04 | Today, Week, Calendar, Kanban, List, Timeline/Gantt, Portfolio, Overdue, Waiting, Completed, Eisenhower and Weekly Review views. | 1 calendar/Kanban/list; expansion later | M1 §4 | Views operate on the same persisted records, preserve selected scope and handle empty states. |
| P05 | Natural-language task capture and extraction from approved notes/messages/emails; assess urgency, importance, impact, effort, dependencies, workload. | 1 basic assistant; 2+ extraction | M1 §§4,9 | Structured proposal with explicit confirmation where required; authentic records inform prioritization. |
| A01 | Contextual central concierge: morning briefing, end-of-day review, weekly CEO review, meeting preparation and post-meeting action extraction. | 1 basic; 2+ grounded inputs | M1 §9 | Uses only authorized available inputs; absent Calendar/Gmail/research stated; no claim to external action without tool result. |
| A02 | EN/AR natural-language commands with scoped tool calling, structured outputs, source-aware RAG, semantic retrieval/vector storage and bounded specialist agents. | 1 interface; 2–3 actual capabilities | M1 §§9,11 | Provider configured and real calls verified before calling AI live; tool authorization enforced server-side independently of model text. |
| W01 | WASL dashboard: strategy/program milestones, BD/partnership/bid pipelines, verified revenue, contacts, responsibilities, monthly priorities, risks and objectives; challenging CEO Advisor. | 3 | M1 §5.1 | Real inputs, source-grounded advice, clear missing evidence; no invented KPI. |
| W02 | Daily opportunity intelligence is mandatory, MENA-focused with Yemen/underserved-market priority. Covers tenders/RFP/RFQ/RFI/EOI/ToR, program/venture contracts, grants, partnerships, events, research, and early signals. | 3 | M1 §5.2 | Real authorized source retrieval with official links, timestamps, records and logs. |
| W03 | Use permitted APIs/search/RSS/public retrieval; procurement/donor/UN/development bank/INGO/foundation/ecosystem/corporate/official/news/event sources. Social data only permitted APIs/authorized access. | 3 | M1 §§5.2,11 | Source access logged; respect platform rules; never claim an unaccessed source was scanned. |
| W04 | Opportunity fields: title, buyer, country/type/description, official/supporting links, publication/deadline, eligibility/geographic rules, verified budget, WASL fit/strategic/commercial/delivery analysis, needed partners, next action/owner/status, verification/confidence, 0–100 score and Apply/Explore/Partner/Monitor/Pass. | 3 | M1 §5.2 | Null/unknown for unsupported values; explicit evidence and fact/inference separation. |
| W05 | Opportunity filtering/sorting/save/comment/tag/archive; convert to project or CRM conversation. | 3 | M1 §5.2 | Persistent workflow with workspace authorization and audit history. |
| W06 | Configurable opportunity weights: capability 25%, strategy 20%, commercial/partnership 20%, qualification/delivery 15%, urgency 10%, ecosystem value 10%. Eligibility gates direct application independently of attractiveness. | 3 | M1 §5.2 | Deterministic scoring tests and failed-eligibility case cannot produce Apply. |
| W07 | Daily background scan even with app closed; suggested default 08:00 Africa/Cairo, configurable. Discovery, extraction, verification, deduplication, eligibility, scoring, recommendation, DB update, briefing, significant notifications. | 3,6 | M1 §5.2 | Successfully executed deployed scheduled job, time-zone-aware schedule, independent of open browser. No local timer labeled deployed cron. |
| W08 | Manual Scan Now; logs, timestamps, provenance, errors/retries/rate limits and idempotency; distinguish new/updated/expired/unverified/archived. | 3 | M1 §§5.2,11 | Re-scan updates same item, failed sources remain failed, logs inspectable. |
| W09 | Experts/mentors DB: factual identity/title/org/country/bio/experience/professional public links/permitted email, references, specialties/program match, suitability, relationship/outreach and verification. | 3 | M1 §5.3 | Verified facts vs inferred match, update dates, real outreach tracker and matching evidence. |
| W10 | Competitor/collaborator DB: services/customers/programs/positioning/footprint/partnerships/public contracts/outcomes, evidenced strengths/gaps/threats, comparisons/change reports. | 3 | M1 §5.4 | Cited public claims; no invented competitor weaknesses. |
| W11 | Research/reading library: credible resources, author/date/link, insights, application, suggested program/SOP improvement, priority/read time/status; Turn This Into Action. | 3 | M1 §5.5 | Cited resource and persisted actionable proposal/task, not only summary. |
| W12 | Marketing intelligence/content calendar: themes, posts/articles/newsletters/reports/PR/events/campaigns, competitor public content; why now/audience/objective/angle/format/evidence/CTA. | 3 | M1 §5.6 | Align with real mission/capability; EN/AR drafts; never publish without approval. |
| W13 | Strategy advisory board: strategy, revenue, partnerships, program innovation, operations, ecosystem and sustainability perspectives; challenge assumptions and track experiments. | 3 | M1 §5.7 | Internal evidence + sourced intelligence + explicit assumptions. |
| W14 | Weekly North Star: one focus sentence, rationale, three actions, key relationship, biggest risk, deprioritization and measurable outcome; changes follow actual progress. | 3 | M1 §5.8 | Source/date-linked recommendation, no arbitrary weekly variation. |
| W15 | APPLY WITH X: independent vs consortium eligibility, gaps, verified partner profiles, lead/structure/roles/value proposition, requirements/missing evidence, outreach draft, bid/no-bid, checklist/workplan. | 3 | M1 §5.9 | Cite opportunity and partner evidence; no implied partner agreement or promised award; explain “Win Strategy” is an approach. |
| W16 | Programs/Curriculum Studio: diagnostics, theory of change, learning outcomes/journey, workshops/mentoring, assignments/milestones, MEAL, budgets/resources, SOPs, sponsorship and reporting. | 3 | M1 §5.10 | Context-specific design with credible references; Google Docs/Sheets export only with authorization. |
| W17 | Company Brain: authorized Drive as connected source, explicit folder/document allowlisting, taxonomy, metadata/search/semantic retrieval/citations and permission-change sync. | 2–3 | M1 §5.11 | Cited original document, scoped retrieval; documented facts/inference/unknowns; unsupported achievements excluded. |
| T01 | THV dashboard: Softlanding/Venture projects, startup portfolio, milestones/meetings/follow-ups/delegation/approvals/risks/reports/comms. | 4 | M1 §6.1 | Actual THV records, no WASL document or account leakage. |
| T02 | Softlanding operating model first: sourcing, intake, eligibility/screen/selection, onboarding/needs, market entry/regulatory coordination/stakeholders/access/pilots, delivery/performance/report/escalation, graduation/alumni. | 4 | M1 §6.2 | Baseline labeled proposed until THV-approved sources establish actual process. |
| T03 | SOP studio: ID/objective/owner/inputs/steps/roles/RACI/gates/SLAs/templates/escalation/checks/evidence/outputs, editable maps/checklists, version and approval history. | 4 | M1 §6.2 | Create/edit/version/approve an SOP and preserve provenance. |
| T04 | Venture Building second: discovery/thesis/validation/feasibility/business model/MVP/pilot/GTM/team/partners/investment/KPI/governance/portfolio/scale-stop; tasks/docs/roles/dates/approvals linked. | 4 | M1 §6.3 | Isolated operational workflow with reviewed source basis. |
| T05 | Startup portfolio/stakeholder directory/partnership and pilot tracker/meeting notes/follow-ups/status reports; email/meeting preparation. | 4 | M1 §6.4 | Persistent THV records; no external changes/messages/commitments without approval. |
| I01 | Personal positioning, thought-leadership pillars/audiences, reputation/career/networking roadmap; biography, speaker profile, website/portfolio, content/events/awards/media/achievements. | 5 | M1 §§7.1–7.2 | Authorized verified career facts; drafts not publication. |
| I02 | Personal relationship tracker: contact/org/context/history/last interaction/follow-up/collaboration/outreach; authorized email/note extraction. | 5 | M1 §7.3 | Real isolated CRM and approved source-derived follow-ups. |
| I03 | Personal appointments/routines/dates/goals/reading/commitments/annual/long-term planning with restrained notification burden. | 5 | M1 §7.4 | Persistent personal-only records and configurable notifications. |
| I04 | Freelancing: clients/leads/proposals/contracts/SOW/projects/deliverables/dates/invoices/payment/stakeholders/time/follow-ups/portfolio. Volunteering: orgs/roles/events/commitments/groups/responsibilities/milestones/contacts/contributions/outcomes. | 1 common engine; 5 specialized | M1 §8 | Independent subspaces and records, shared PM implementation. |
| G01 | Google Drive: authorized discovery/search/retrieval/metadata/indexing/change sync, deep links; document writes only authorized. | 2 | M1 §10 | Real OAuth/API access and permission-revocation tests. |
| G02 | Gmail: authorized search/retrieval, pending replies/task suggestions, drafts, contact/project/task links, deadlines and follow-ups. Never auto-send. | 2 | M1 §10 | Real authorized email → proposal → explicit approval → task; send protected. |
| G03 | Calendar: authorized events/availability/conflicts, meeting/task/project links and briefings; writes after approval. | 2 | M1 §10 | Retrieve real event and link task; approved write path and error cases. |
| G04 | OAuth minimal scopes, secure backend tokens, independent workspace account/scope connections; no private-account crossover for same owner. | 2 | M1 §10 | State/PKCE or equivalent secure flow, encrypted server-side storage and cross-workspace denial. |
| D01 | Normalized schema for users/workspaces/memberships/roles, PM records, meetings/follow-ups/CRM, opportunity/evidence/bids/experts/competitors/research/content/curriculum/SOPs, docs/chunks, integrations/jobs/notifications/audit/AI recommendations/decisions. | 0–5 | M1 §12 | Stable IDs, timestamps, ownership, provenance, migrations and relationship constraints as each entity is delivered. |
| D02 | Scope every query, authorization rule, vector search and AI retrieval; narrowly defined global aggregation; export and backup. | 1 onward | M1 §12 | Adversarial isolation tests plus verified export/restore in hardening. |
| S01 | Privacy, actual RBAC/least privilege, secure secrets/tokens, transit/rest encryption, audit, retention/deletion, job recovery. | 1–6 | M1 §13; C2 | Server/database enforcement, no secrets in browser/source/logs; production controls separately verified. |
| S02 | Retrieved documents/emails/pages are untrusted inputs and cannot override instructions or authorize actions. THV data cannot cross to WASL; no proprietary training by default. | 1 onward | M1 §13; C2–C3 | Prompt-injection and scope tests; purpose-specific authorization for any sharing. |
| S03 | Explicit approval for externally consequential AI actions: messages, applications, confidential sharing, commitments, deletions; U1 also gates deployment/production DB/irreversible work. | All | U1; M1 §§9,13 | Approver, exact action, outcome and audit record; unapproved tool action denied. |
| Q01 | Every visible button performs a real action; forms persist actual state; metrics come from records or explicit external source. No unlabelled demo/feed/integration. | All | U1; M1 §§14,16 | Empty/error/loading/unauthorized states, real workflows and truthful status labels. |
| Q02 | Maintain exact feature status, implementation/test evidence, blockers/config/auth/deployment needs; source, schema/setup, architecture, agents, connectors, research/jobs, deployment guide, verification and roadmap deliverables. | All | U1; M1 §§16,18 | No invented URL, path, integration, test pass or scheduled-job success. |

## Required end-to-end acceptance scenarios

These are specification gates, not recorded test outcomes.

| M1 §17 test | Required scenario | Phase / external prerequisites |
|---|---|---|
| 1 | Create WASL task, reload, confirm persisted record. | 1 |
| 2 | THV-only document cannot be retrieved by WASL AI query. | 1 authorization foundation; 2–3 document/RAG integration |
| 3 | Create project with milestones, dependencies, deadlines/tasks; verify progress and risk. | 1 engine, expanded project capabilities |
| 4 | Authorized calendar event retrieved and linked to task. | 2; Google credentials/consent |
| 5 | Authorized email suggests a task; creation only after approval. | 2; Google credentials/consent |
| 6 | Real scheduled opportunity scan produces authentic URLs, timestamps and fit scores. | 3/6; deployment approval + deployed scheduler |
| 7 | Repeat scan updates existing opportunity rather than duplicating. | 3 |
| 8 | APPLY WITH X cites verified partner evidence and eligibility gaps. | 3 |
| 9 | Program module matches verified experts. | 3 |
| 10 | Indexed WASL-document answer cites original and separates evidence from interpretation. | 2–3; authorized source ingestion/model configuration |
| 11 | Create/edit/version/approve Softlanding SOP. | 4 |
| 12 | Daily briefing uses actual tasks, authorized calendar and verified intelligence. | 1 foundation; complete 2–3 |
| 13 | Official WASL assets; no fabricated official THV logo. | 0–1; official THV image verified in supplied company deck |
| 14 | Critical workflows pass desktop and mobile browser validation. | 1 onward |
| 15 | Expired OAuth/unavailable API/job failure/missing data never displays false success. | 1 errors; complete 2–3/6 |

The kit adds tests for unknown information, conflicting evidence, no assumed live CRM, source injection, sensitive-action approval, and no external-action claim without successful tool execution. Its fictional sample outcomes must not be treated as WASL acceptance-test results.

## Trust and knowledge-record conventions derived from the kit

Use `owner_role`, `last_verified` (ISO date or unknown), `status` (draft/approved), `classification` (public/internal/restricted), source IDs, fact/unknown/conflict fields, review questions and change history when implementing Company Brain. Generated records stay drafts until a real reviewer approves them. An instruction file is not technical access control. Sensitive records require actual authorization; do not copy credentials, identity/payment/health data, payroll, or restricted contracts into the Brain merely because a template exists.

AI operational responses should expose confirmed information and source/time, distinguish analysis/assumptions, list recommended actions with owner/date/approval/evidence, and state missing information/confidence. Prefer concise EN/AR language; keep product/file identifiers intact. Missing integrations must show disconnected rather than a fictitious current-day result.

## Known audit limitations and decisions still required

- The selected checkout was empty before implementation. No pre-existing application workflow, manifests, or source code was available to preserve.
- Brand and filing ZIPs were not read because each exceeds the transfer tool's 32 MiB limit. Smaller relevant extracts or authorized Drive access can resolve that limitation; do not block unrelated engineering on these assets.
- The official THV logo was found and extracted from the authorized deck (see BRAND_SOURCES.md). Approved proprietary THV process documents remain unavailable; label any SOP baseline as proposed, never invented official policy.
- Google OAuth, managed Supabase/Postgres, external model/search providers, hosted scheduler, production secrets, deployment approval and UAT require independent verification when available. Their absence does not authorize simulated live functionality.
- A local embedded database or alternative development runtime may support genuine Phase 1 persistence, but any deviation from managed PostgreSQL must be documented; local validation does not establish production authentication, backups, encryption-at-rest or hosted reliability.
- Product-complete means all mandatory later-phase workflows and production gates pass. Delivering a usable Phase 1 is an incremental milestone, not completion of the entire specification.
