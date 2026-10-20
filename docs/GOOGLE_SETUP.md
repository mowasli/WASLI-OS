# Google Workspace connection foundation

This code provides server-side OAuth and narrowly scoped read endpoints. No Google account was connected during development: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` and `TOKEN_ENCRYPTION_KEY` were absent when checked. Unit tests use explicitly synthetic token responses, never live email, Drive documents, or events. Do not report Google synchronization as operational until a user completes consent and real API reads are verified.

## Implemented boundaries

- Each connection belongs to one signed-in user, one workspace and one service. Other members cannot use the connection owner's private account, even in the same workspace.
- The server verifies workspace membership and role before connecting/selecting/disconnecting. Mutations require same-origin requests. The callback requires the same authenticated session that began consent.
- OAuth state is random, SHA-256 hashed in storage, expires after ten minutes, bound to user/session/workspace/service, and atomically consumed once. The workspace comes from stored state, never callback query parameters. PKCE S256 protects the code exchange.
- Access/refresh tokens and PKCE verifiers use AES-256-GCM. Additional authenticated data binds ciphertext to its user/workspace/service/purpose. The encryption key stays in protected server environment configuration, separate from PostgreSQL.
- Tokens are exchanged/refreshed only on the backend; no token is returned to browser code. Token/revocation calls use fixed Google HTTPS hosts and a scoped proxy-aware transport. TLS verification remains enabled; redirects are rejected. Errors do not echo tokens, authorization codes, client secrets, or proxy configuration.
- OAuth/connection/selected-file tables enable row-level security with no browser policies and revoke public access. Use an approved server database role; do not expose these tables through a browser Supabase client. Application authorization still runs on every endpoint independently.
- Refresh failures and upstream permission failures mark the connection `reconnect_required`; expired but refreshable tokens show `refresh_pending`. A stored authorization does not prove that every later API request will succeed.
- New OAuth consent always replaces stored credentials and clears selected Drive IDs atomically. If Google supplies no refresh token, none is retained from the previous consent; reauthorization is required after expiry. Only refresh grants preserve their own existing refresh token. Credential generations prevent an in-flight old refresh from overwriting newer consent or recreating a disconnected connection.
- Minimal service scopes do not verify a stable Google subject identity. The product must not claim it verified the Google account's person or email address. Re-select Drive documents after each new consent; do not silently assume the same Google account was selected.
- No email send, Calendar write, Drive content indexing, document editing, account-wide scan, external sharing or automatic task creation exists in this foundation. These capabilities remain pending and need explicit approval paths.

## Minimal scopes

| Service | Requested scope | Current retrieval |
|---|---|---|
| Drive | `https://www.googleapis.com/auth/drive.file` | Metadata of explicitly selected IDs that Google already permits this app to access; never a broad account listing or content ingestion. |
| Gmail | `https://www.googleapis.com/auth/gmail.readonly` | Up to ten matching message/thread IDs. Bodies are not fetched or indexed. Google has no narrower message-listing-only scope. |
| Calendar | `https://www.googleapis.com/auth/calendar.events.readonly` | Up to twenty upcoming primary-calendar events, selected fields only. |

Drive file selection in this implementation records **application-level authorization only**. It does not make Google grant access to arbitrary existing files. Such files must be selected through Google Picker or otherwise already authorized under `drive.file`. Picker UI and document indexing are pending. If a selected ID is not granted by Google, retrieval must fail honestly; do not widen the scope to bypass that boundary.

Google may require OAuth app verification for sensitive/restricted scopes, especially Gmail. Test-user authorization, verification, organization policy and any required provider assessment remain the operator's responsibility before production use.

## Configuration

1. Create a Google Cloud project and OAuth web application under the user's authorized organization. Enable Drive API, Gmail API and Google Calendar API. Configure the consent screen, minimal requested scopes and authorized test users. Platform service-account credentials are not user consent and must not be substituted.
2. Register an exact redirect URI ending in `/api/integrations/google/callback`. Production requires HTTPS. For isolated development, `http://localhost:3000/api/integrations/google/callback` is accepted. Do not register a redirect to an untrusted host.
3. Supply these variables through protected server environment settings, never chat, client bundles, committed files or logs:

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client identifier. |
| `GOOGLE_CLIENT_SECRET` | Server-side OAuth client secret. |
| `GOOGLE_REDIRECT_URI` | Exact registered callback URI; no query/fragment. |
| `TOKEN_ENCRYPTION_KEY` | Canonical base64 encoding of 32 cryptographically random bytes, kept separate from database backups. |

Generate and store the encryption key using a trusted secret manager; do not print it into application logs. Retain it securely for restore. Changing it without a controlled re-encryption migration makes existing tokens unreadable; disconnect/reconnect accounts or implement key rotation before changing production values.

4. For managed PostgreSQL, have an authorized operator review and apply `supabase/migrations/0004_google.sql` after its core dependencies. Runtime never applies this migration when `DATABASE_URL` is configured. Local embedded development initializes the same tables additively. No production database was changed during implementation.
5. Permit `accounts.google.com` for browser consent and `oauth2.googleapis.com`, `www.googleapis.com`, `gmail.googleapis.com` for server OAuth/API access in the relevant network policy. Keep existing required domains. The server honors supported proxy environment configuration using a scoped `undici` dispatcher.
6. Restart the server after changing configuration. Configuration status shows missing/invalid variable **names only**. An incomplete configuration returns HTTP 503 when a connection/read is requested and does not fabricate a connection.

## API usage

All endpoints require a real signed-in application session. POST requests require `Content-Type: application/json` and an `Origin` matching the application origin. Example values below describe request shapes; they are not connected live accounts.

| Endpoint | Input / behavior |
|---|---|
| `GET /api/integrations?workspace=wasl` | Returns server configuration status and only this user's Drive/Gmail/Calendar connection states for the authorized workspace. |
| `POST /api/integrations/google/connect` | `{workspaceId, service}` where service is `drive`, `gmail` or `calendar`. Returns a real authorization URL and `connected:false`; browser navigates to Google for consent. |
| `GET /api/integrations/google/callback` | Google supplies state/code. Callback validates session/state, exchanges code, encrypts tokens, records audit and redirects to the application. A denied consent does not create a connection. |
| `POST /api/integrations/google/drive/selection` | `{workspaceId, fileIds:[...], confirm:true}` replaces this connection's explicit document allowlist (max 50). No content is indexed. |
| `GET /api/integrations/google/read?workspace=wasl&service=drive` | Retrieves metadata for up to ten selected files; optional `fileId` must be selected. No selected files returns an explicit requirement rather than scanning the account. |
| `GET /api/integrations/google/read?workspace=wasl&service=gmail&query=...` | Read-only Google query, max 200 characters; returns matching IDs only. |
| `GET /api/integrations/google/read?workspace=wasl&service=calendar&query=...` | Read-only upcoming primary-calendar event retrieval. No event creation/modification. |
| `POST /api/integrations/google/disconnect` | `{workspaceId, service, confirm:true}` deletes local encrypted credentials and selection. Add `revokeAtGoogle:true` only after explicit approval of revocation at Google. |

Disconnecting locally does not imply Google access was revoked. Optional Google revocation reports `succeeded` or `failed` separately; local disconnection still occurs. Google revocation can affect other grants associated with the same app/account, so the UI must explain this consequence before asking for that separate action. An unsuccessful revocation must direct the user to remove access in their Google Account settings if needed.

## Verification and remaining acceptance

`tests/google.test.ts` exercises authenticated encryption/integrity and context binding, scope restrictions, state replay/expiry/user/session/workspace binding, PKCE, encrypted credential persistence, owner/workspace isolation, Drive allowlisting, new-consent replacement without refresh-token retention, selection clearing, generation-bound refresh and disconnect races, revoked-token failure states, truthful revocation failure and missing configuration. Its HTTP token/API responses are controlled unit-test fixtures, not live integration evidence.

Pending live checks require credentials and user authorization: complete Google consent for each service/workspace, retrieve an authorized event and link a task, retrieve an authorized email and approve a task suggestion, select/retrieve a permitted Drive document, revoke authorization and verify failure, confirm account/workspace isolation, and review production OAuth/security requirements. Meeting preparation, permission-aware indexing/synchronization, email task extraction, approved external writes and incremental sync are not implemented by these endpoints.
