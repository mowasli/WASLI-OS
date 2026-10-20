# Specialist operations implementation

## Implemented capabilities

THV has a persistent SOP Studio with separate Softlanding/Venture Building categories. A new SOP starts as a draft. Every content/title/category revision adds a new immutable snapshot; existing approved content is retained. Only a THV workspace owner may approve a version. The approval request carries the version actually reviewed; a transaction locks the SOP and rejects stale approval with409 if an editor has saved a new version in the meantime. An approved row cannot be updated or deleted, enforced by a PostgreSQL trigger in addition to server authorization. SOPs can be archived/restored without deleting version history.

The optional Softlanding baseline is explicitly a proposed draft from the product specification. It is never automatically created or presented as THV's actual approved procedure. No THV proprietary document is copied to WASL.

Workspace-scoped contacts, THV startup portfolio records, personal/WASL content planning and independent engagements support persisted create/update/archive/delete. Freelance and volunteer categories are restricted to the Independent workspace. Content records are drafts/planning only: no posts are published, emails sent or external commitments created.

## Authorization and storage

Every operation checks authenticated workspace membership. Viewers can read only; editors can draft/edit records and SOPs; owners approve SOPs. Object IDs are checked against their actual workspace before mutation. Field validation rejects invalid dates, changed record kinds and inappropriate workspace categories. Writes are parameterized and audited. Local storage initializes `0005_operations.sql`; managed PostgreSQL requires separately approved migration and production RLS/identity validation.

## Interface and API

`OperationsPanel({workspaceId, role})` is a reusable client panel. GET `/api/operations?workspace=...` returns `{sops,records}`. POST creates a typed record. PATCH `/api/operations/:id` updates records or appends an SOP revision. POST `/api/operations/:id/approve` requires `{expectedVersion:number}` and approves that draft only when it is still the current version. DELETE only deletes non-SOP records after explicit interface confirmation; SOP history uses archive instead.

## Validation status and limits

`tests/operations.test.ts` exercises scope/role denial, owner approval, database-enforced immutability, revision preservation, archive behavior, typed categories, genuine calendar dates and audit events against disposable PostgreSQL. Record actual execution results in the implementation log.

This is a practical specialist foundation, not a completed THV operating model or full CRM/accounting system. Detailed RACI/gate/SLAs remain editable SOP text; structured workflow maps, automated startup lifecycle transitions, invoice/payment processing, social publishing and external outreach remain pending. Real operating procedures require authorized company evidence and review.
