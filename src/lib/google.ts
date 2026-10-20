import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { ApiError, SESSION_COOKIE } from './auth';
import type { Database } from './db';
import type { WorkspaceId } from './types';

export const GOOGLE_SERVICES = ['drive', 'gmail', 'calendar'] as const;
export type GoogleService = typeof GOOGLE_SERVICES[number];
export const GOOGLE_SCOPES: Record<GoogleService, string> = {
  drive: 'https://www.googleapis.com/auth/drive.file',
  gmail: 'https://www.googleapis.com/auth/gmail.readonly',
  calendar: 'https://www.googleapis.com/auth/calendar.events.readonly',
};
export interface GoogleConfig { clientId: string; clientSecret: string; redirectUri: string; encryptionKey: Buffer }
interface Binding { userId: string; sessionHash: string }
interface StateRow { user_id: string; workspace_id: WorkspaceId; service: GoogleService; verifier_ciphertext: string }
interface AccountRow {
  id: string; user_id: string; workspace_id: WorkspaceId; service: GoogleService;
  access_ciphertext: string; refresh_ciphertext: string | null; expires_at: string;
  granted_scopes: string[]; updated_at: string; status: 'connected' | 'reconnect_required'; credential_generation: string;
}
interface GoogleTokens { access_token: string; refresh_token?: string; expires_in: number; scope?: string; token_type?: string }
export type GoogleFetch = typeof fetch;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
let googleDispatcher: import('undici').EnvHttpProxyAgent | undefined;
// Scoped transport honors the platform proxy without changing global fetch or
// copying proxy configuration into logs, browser code, or saved credentials.
const googleNetworkFetch: GoogleFetch = async (input, init) => {
  const { EnvHttpProxyAgent, fetch: proxyFetch } = await import('undici');
  googleDispatcher ??= new EnvHttpProxyAgent();
  const url = typeof input === 'string' || input instanceof URL ? input : input.url;
  const response = await proxyFetch(url, {
    method: init?.method, headers: Object.fromEntries(new Headers(init?.headers).entries()),
    body: init?.body instanceof URLSearchParams ? init.body : undefined,
    signal: init?.signal ?? undefined, redirect: init?.redirect, dispatcher: googleDispatcher,
  });
  return response as unknown as Response;
};

// Apply this schema through an approved migration for a managed database. Runtime
// DDL is permitted only for the isolated embedded development database.
export const GOOGLE_STORAGE_SCHEMA = `
CREATE TABLE IF NOT EXISTS integration_oauth_states (
 state_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 workspace_id text NOT NULL REFERENCES workspaces(id), service text NOT NULL CHECK(service IN ('drive','gmail','calendar')),
 session_hash text NOT NULL, verifier_ciphertext text NOT NULL, expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS integration_oauth_expiry_idx ON integration_oauth_states(expires_at);
CREATE TABLE IF NOT EXISTS integration_accounts (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 workspace_id text NOT NULL REFERENCES workspaces(id), service text NOT NULL CHECK(service IN ('drive','gmail','calendar')),
 access_ciphertext text NOT NULL, refresh_ciphertext text, expires_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'connected' CHECK(status IN ('connected','reconnect_required')),
 credential_generation uuid NOT NULL DEFAULT gen_random_uuid(),
 granted_scopes text[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,workspace_id,service), UNIQUE(id,workspace_id)
);
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'connected' CHECK(status IN ('connected','reconnect_required'));
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS credential_generation uuid NOT NULL DEFAULT gen_random_uuid();
CREATE TABLE IF NOT EXISTS integration_drive_files (
 integration_id uuid NOT NULL, workspace_id text NOT NULL, file_id text NOT NULL,
 selected_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(integration_id,file_id),
 FOREIGN KEY(integration_id,workspace_id) REFERENCES integration_accounts(id,workspace_id) ON DELETE CASCADE
);
ALTER TABLE integration_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_drive_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON integration_oauth_states,integration_accounts,integration_drive_files FROM PUBLIC;`;

export async function ensureGoogleStorage(database: Database): Promise<void> {
  if (!process.env.DATABASE_URL) await database.exec(GOOGLE_STORAGE_SCHEMA);
}

export function googleConfigurationStatus(): { configured: boolean; missing: string[]; invalid: string[] } {
  const names = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'TOKEN_ENCRYPTION_KEY'];
  const missing = names.filter(name => !process.env[name]?.trim());
  const invalid: string[] = [];
  if (process.env.GOOGLE_REDIRECT_URI) {
    try { validateRedirectUri(process.env.GOOGLE_REDIRECT_URI); } catch { invalid.push('GOOGLE_REDIRECT_URI'); }
  }
  if (process.env.TOKEN_ENCRYPTION_KEY) {
    try { readEncryptionKey(process.env.TOKEN_ENCRYPTION_KEY); } catch { invalid.push('TOKEN_ENCRYPTION_KEY'); }
  }
  return { configured: !missing.length && !invalid.length, missing, invalid };
}

function validateRedirectUri(value: string): void {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.hash || url.search) {
    throw new Error('OAuth redirect must use HTTPS, except HTTP loopback development');
  }
  if (url.pathname !== '/api/integrations/google/callback') throw new Error('Unexpected OAuth callback path');
}

export function readEncryptionKey(encoded: string): Buffer {
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) throw new Error('TOKEN_ENCRYPTION_KEY must be a canonical base64-encoded 32-byte key');
  return key;
}

export function requireGoogleConfig(): GoogleConfig {
  const status = googleConfigurationStatus();
  if (!status.configured) throw new ApiError(503, `Google OAuth is not configured. Missing: ${status.missing.join(', ') || 'none'}. Invalid: ${status.invalid.join(', ') || 'none'}.`);
  return {
    clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI!, encryptionKey: readEncryptionKey(process.env.TOKEN_ENCRYPTION_KEY!),
  };
}

export function parseGoogleService(value: unknown): GoogleService {
  if (typeof value !== 'string' || !GOOGLE_SERVICES.includes(value as GoogleService)) throw new ApiError(400, 'Invalid Google service');
  return value as GoogleService;
}

export function googleSessionBinding(request: Request, userId: string): Binding {
  const cookie = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(`${SESSION_COOKIE}=`));
  const value = cookie?.slice(SESSION_COOKIE.length + 1);
  if (!value || !/^[\w-]{43}$/.test(value)) throw new ApiError(401, 'A valid signed-in session is required');
  return { userId, sessionHash: sha256(value) };
}

export function encryptGoogleSecret(plaintext: string, key: Buffer, context: string): string {
  if (key.length !== 32) throw new Error('Invalid encryption key length');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptGoogleSecret(encoded: string, key: Buffer, context: string): string {
  try {
    const [version, ivText, tagText, ciphertextText, extra] = encoded.split('.');
    if (version !== 'v1' || !ivText || !tagText || !ciphertextText || extra) throw new Error('Invalid encrypted secret');
    const iv = Buffer.from(ivText, 'base64url'), tag = Buffer.from(tagText, 'base64url');
    if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid cipher parameters');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8');
  } catch { throw new ApiError(503, 'Stored Google credentials could not be decrypted. Reconnect the account using the configured encryption key.'); }
}

const tokenContext = (userId: string, workspaceId: WorkspaceId, service: GoogleService, kind: 'access' | 'refresh') => `google:${userId}:${workspaceId}:${service}:${kind}`;
const verifierContext = (stateHash: string, userId: string, workspaceId: WorkspaceId) => `google-state:${stateHash}:${userId}:${workspaceId}`;

export async function beginGoogleOAuth(database: Database, binding: Binding, workspaceId: WorkspaceId, service: GoogleService, config: GoogleConfig): Promise<string> {
  const state = randomBytes(32).toString('base64url'), verifier = randomBytes(32).toString('base64url');
  const stateHash = sha256(state);
  await database.query('DELETE FROM integration_oauth_states WHERE expires_at < now()');
  await database.query('INSERT INTO integration_oauth_states(state_hash,user_id,workspace_id,service,session_hash,verifier_ciphertext,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval \'10 minutes\')', [
    stateHash, binding.userId, workspaceId, service, binding.sessionHash,
    encryptGoogleSecret(verifier, config.encryptionKey, verifierContext(stateHash, binding.userId, workspaceId)),
  ]);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code',
    scope: GOOGLE_SCOPES[service], state, access_type: 'offline', prompt: 'consent select_account',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
    include_granted_scopes: 'false',
  }).toString();
  return url.toString();
}

export async function consumeGoogleOAuthState(database: Database, state: string, binding: Binding, config: GoogleConfig): Promise<{ workspaceId: WorkspaceId; service: GoogleService; verifier: string }> {
  if (!/^[\w-]{43}$/.test(state)) throw new ApiError(400, 'Invalid OAuth state');
  const stateHash = sha256(state);
  // Atomic deletion prevents replay. A wrong user/session cannot consume another
  // session's state, and callback query parameters cannot choose the workspace.
  const result = await database.query<StateRow>('DELETE FROM integration_oauth_states WHERE state_hash=$1 AND user_id=$2 AND session_hash=$3 AND expires_at>now() RETURNING user_id,workspace_id,service,verifier_ciphertext', [stateHash, binding.userId, binding.sessionHash]);
  const row = result.rows[0];
  if (!row) throw new ApiError(400, 'OAuth state has expired, was already used, or belongs to another session');
  return { workspaceId: row.workspace_id, service: row.service, verifier: decryptGoogleSecret(row.verifier_ciphertext, config.encryptionKey, verifierContext(stateHash, binding.userId, row.workspace_id)) };
}

async function tokenRequest(body: URLSearchParams, requester: GoogleFetch = googleNetworkFetch): Promise<GoogleTokens> {
  let response: Response;
  try { response = await requester('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, redirect: 'error', signal: AbortSignal.timeout(15_000) }); }
  catch { throw new ApiError(502, 'Google token endpoint is unavailable. No connection was confirmed.'); }
  if (!response.ok) throw new ApiError(response.status === 400 || response.status === 401 ? 401 : 502, 'Google authorization could not be completed or refreshed. Reconnect the account.');
  let value: Partial<GoogleTokens>;
  try { value = await response.json() as Partial<GoogleTokens>; }
  catch { throw new ApiError(502, 'Google returned an invalid token response'); }
  if (!value || typeof value.access_token !== 'string' || !value.access_token || typeof value.expires_in !== 'number' || !Number.isFinite(value.expires_in) || value.expires_in <= 0 || value.expires_in > 86400 || (value.refresh_token !== undefined && typeof value.refresh_token !== 'string') || (value.scope !== undefined && typeof value.scope !== 'string')) throw new ApiError(502, 'Google returned an invalid token response');
  return value as GoogleTokens;
}

export async function finishGoogleOAuth(database: Database, userId: string, workspaceId: WorkspaceId, service: GoogleService, code: string, verifier: string, config: GoogleConfig, requester: GoogleFetch = googleNetworkFetch): Promise<void> {
  if (!code || code.length > 4096) throw new ApiError(400, 'Missing or invalid authorization code');
  const tokens = await tokenRequest(new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code', code, code_verifier: verifier }), requester);
  if (!tokens.scope?.split(' ').includes(GOOGLE_SCOPES[service])) throw new ApiError(403, 'The required Google permission was not granted');
  // Minimal service scopes do not provide a verified Google subject identity.
  // Therefore every new consent is a replacement, even if the human selected
  // the same account: never retain credentials or document selections from the
  // previous authorization when the new grant omits a refresh token.
  await database.transaction(async tx => {
    await saveTokens(tx, userId, workspaceId, service, tokens, config, { grant: 'authorization_code' });
    await tx.query('DELETE FROM integration_drive_files WHERE workspace_id=$2 AND integration_id IN (SELECT id FROM integration_accounts WHERE user_id=$1 AND workspace_id=$2 AND service=$3)', [userId, workspaceId, service]);
  });
}

async function saveTokens(database: Database, userId: string, workspaceId: WorkspaceId, service: GoogleService, tokens: GoogleTokens, config: GoogleConfig, mode: { grant: 'authorization_code' } | { grant: 'refresh_token'; expectedGeneration: string }): Promise<void> {
  const access = encryptGoogleSecret(tokens.access_token, config.encryptionKey, tokenContext(userId, workspaceId, service, 'access'));
  const refresh = tokens.refresh_token ? encryptGoogleSecret(tokens.refresh_token, config.encryptionKey, tokenContext(userId, workspaceId, service, 'refresh')) : null;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const scopes = tokens.scope?.split(' ').filter(Boolean) ?? [GOOGLE_SCOPES[service]];
  if (mode.grant === 'authorization_code') {
    await database.query(`INSERT INTO integration_accounts(id,user_id,workspace_id,service,access_ciphertext,refresh_ciphertext,expires_at,granted_scopes,credential_generation)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(user_id,workspace_id,service) DO UPDATE SET
      access_ciphertext=EXCLUDED.access_ciphertext,refresh_ciphertext=EXCLUDED.refresh_ciphertext,
      expires_at=EXCLUDED.expires_at,granted_scopes=EXCLUDED.granted_scopes,credential_generation=EXCLUDED.credential_generation,status='connected',updated_at=now()`, [
      randomUUID(), userId, workspaceId, service, access, refresh, expiresAt, scopes, randomUUID(),
    ]);
  } else {
    // A refresh belongs only to the authorization generation that started it.
    // Never recreate a disconnected connection or overwrite a newer consent.
    const updated = await database.query(`UPDATE integration_accounts SET access_ciphertext=$1,
      refresh_ciphertext=COALESCE($2,refresh_ciphertext),expires_at=$3,granted_scopes=$4,status='connected',updated_at=now()
      WHERE user_id=$5 AND workspace_id=$6 AND service=$7 AND credential_generation=$8 RETURNING id`, [
      access, refresh, expiresAt, scopes, userId, workspaceId, service, mode.expectedGeneration,
    ]);
    if (!updated.rows.length) throw new ApiError(409, 'The Google connection changed during refresh. Retry using the current connection.');
  }
}

export async function getGoogleAccount(database: Database, userId: string, workspaceId: WorkspaceId, service: GoogleService): Promise<AccountRow> {
  const result = await database.query<AccountRow>('SELECT * FROM integration_accounts WHERE user_id=$1 AND workspace_id=$2 AND service=$3', [userId, workspaceId, service]);
  if (!result.rows[0]) throw new ApiError(409, 'This Google service is not connected for your account in this workspace');
  if (result.rows[0].status === 'reconnect_required') throw new ApiError(401, 'Google authorization is no longer usable. Reconnect this service.');
  return result.rows[0];
}

export async function googleConnectionStatuses(database: Database, userId: string, workspaceId: WorkspaceId): Promise<unknown[]> {
  const result = await database.query<{ service: GoogleService; expires_at: string; refreshable: boolean; updated_at: string; status: string; selected_files: number }>(`SELECT a.service,a.expires_at,(a.refresh_ciphertext IS NOT NULL) AS refreshable,a.updated_at,a.status,
    (SELECT count(*)::int FROM integration_drive_files f WHERE f.integration_id=a.id) AS selected_files
    FROM integration_accounts a WHERE a.user_id=$1 AND a.workspace_id=$2`, [userId, workspaceId]);
  return GOOGLE_SERVICES.map(service => {
    const row = result.rows.find(x => x.service === service);
    return { service, scope: GOOGLE_SCOPES[service], status: row ? (row.status === 'reconnect_required' ? 'reconnect_required' : new Date(row.expires_at).getTime() > Date.now() ? 'connected' : row.refreshable ? 'refresh_pending' : 'expired') : 'disconnected', lastConnectedAt: row?.updated_at ?? null, selectedFiles: row?.selected_files ?? 0, connectionOwnerOnly: true };
  });
}

async function accessToken(database: Database, account: AccountRow, config: GoogleConfig, requester: GoogleFetch): Promise<string> {
  if (new Date(account.expires_at).getTime() > Date.now() + 60_000) return decryptGoogleSecret(account.access_ciphertext, config.encryptionKey, tokenContext(account.user_id, account.workspace_id, account.service, 'access'));
  if (!account.refresh_ciphertext) throw new ApiError(401, 'Google authorization has expired. Reconnect this service.');
  const refresh = decryptGoogleSecret(account.refresh_ciphertext, config.encryptionKey, tokenContext(account.user_id, account.workspace_id, account.service, 'refresh'));
  const tokens = await tokenRequest(new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, grant_type: 'refresh_token', refresh_token: refresh }), requester);
  if (tokens.scope && !tokens.scope.split(' ').includes(GOOGLE_SCOPES[account.service])) throw new ApiError(403, 'Google no longer grants the required permission. Reconnect this service.');
  await saveTokens(database, account.user_id, account.workspace_id, account.service, { ...tokens, scope: tokens.scope ?? account.granted_scopes.join(' ') }, config, { grant: 'refresh_token', expectedGeneration: account.credential_generation });
  return tokens.access_token;
}

async function googleGet(url: URL, token: string, requester: GoogleFetch): Promise<Record<string, unknown>> {
  if (!['www.googleapis.com', 'gmail.googleapis.com'].includes(url.hostname) || url.protocol !== 'https:') throw new ApiError(400, 'Unsupported Google destination');
  let response: Response;
  try { response = await requester(url, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(15_000) }); }
  catch { throw new ApiError(502, 'Google could not be reached. No data was retrieved.'); }
  if (!response.ok) throw new ApiError(response.status === 401 || response.status === 403 ? response.status : 502, 'Google data could not be retrieved. Check account permissions or reconnect.');
  return response.json() as Promise<Record<string, unknown>>;
}

export async function selectGoogleDriveFiles(database: Database, userId: string, workspaceId: WorkspaceId, fileIds: unknown): Promise<number> {
  if (!Array.isArray(fileIds) || fileIds.length > 50 || fileIds.some(x => typeof x !== 'string' || !/^[A-Za-z0-9_-]{10,200}$/.test(x))) throw new ApiError(400, 'Select at most 50 valid Google Drive file IDs');
  const account = await getGoogleAccount(database, userId, workspaceId, 'drive');
  const unique = [...new Set(fileIds as string[])];
  await database.transaction(async tx => {
    const current = await tx.query('SELECT id FROM integration_accounts WHERE id=$1 AND credential_generation=$2 FOR UPDATE', [account.id, account.credential_generation]);
    if (!current.rows.length) throw new ApiError(409, 'The Google connection changed. Select documents again using the current account.');
    await tx.query('DELETE FROM integration_drive_files WHERE integration_id=$1 AND workspace_id=$2', [account.id, workspaceId]);
    for (const id of unique) await tx.query('INSERT INTO integration_drive_files(integration_id,workspace_id,file_id) VALUES($1,$2,$3)', [account.id, workspaceId, id]);
  });
  return unique.length;
}

export async function readGoogleData(database: Database, userId: string, workspaceId: WorkspaceId, service: GoogleService, query: string, fileId: string | null, config: GoogleConfig, requester: GoogleFetch = googleNetworkFetch): Promise<unknown> {
  const account = await getGoogleAccount(database, userId, workspaceId, service);
  try { return await readGoogleDataInternal(database, account, query, fileId, config, requester); }
  catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status) && !error.message.includes('not selected')) {
      await database.query("UPDATE integration_accounts SET status='reconnect_required' WHERE user_id=$1 AND workspace_id=$2 AND service=$3 AND credential_generation=$4", [userId, workspaceId, service, account.credential_generation]);
    }
    throw error;
  }
}

async function readGoogleDataInternal(database: Database, account: AccountRow, query: string, fileId: string | null, config: GoogleConfig, requester: GoogleFetch): Promise<unknown> {
  if (query.length > 200) throw new ApiError(400, 'Search query must be 200 characters or fewer');
  const workspaceId = account.workspace_id, service = account.service;
  const token = await accessToken(database, account, config, requester);
  if (service === 'drive') {
    const selected = (await database.query<{ file_id: string }>('SELECT f.file_id FROM integration_drive_files f JOIN integration_accounts a ON a.id=f.integration_id WHERE f.integration_id=$1 AND f.workspace_id=$2 AND a.credential_generation=$3 ORDER BY f.selected_at LIMIT 50', [account.id, workspaceId, account.credential_generation])).rows.map(x => x.file_id);
    if (!selected.length) throw new ApiError(409, 'No Drive documents are authorized for this workspace. Explicitly select documents first; the account is never indexed automatically.');
    if (fileId && !selected.includes(fileId)) throw new ApiError(403, 'This Drive document is not selected for this workspace');
    const ids = fileId ? [fileId] : selected.slice(0, 10);
    const files: Record<string, unknown>[] = [];
    for (const id of ids) {
      const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`);
      url.searchParams.set('fields', 'id,name,mimeType,modifiedTime,webViewLink');
      files.push(await googleGet(url, token, requester));
    }
    return { files, metadataOnly: true, authorizedFileCount: selected.length, returnedFileCount: files.length, indexed: false };
  }
  if (service === 'gmail') {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    url.search = new URLSearchParams({ maxResults: '10', q: query, fields: 'messages(id,threadId),nextPageToken,resultSizeEstimate' }).toString();
    return { ...await googleGet(url, token, requester), messageBodiesRetrieved: false, readOnly: true };
  }
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.search = new URLSearchParams({ maxResults: '20', singleEvents: 'true', orderBy: 'startTime', timeMin: new Date().toISOString(), q: query, fields: 'items(id,summary,start,end,htmlLink,status),nextPageToken,timeZone' }).toString();
  return { ...await googleGet(url, token, requester), readOnly: true };
}

export async function disconnectGoogle(database: Database, userId: string, workspaceId: WorkspaceId, service: GoogleService, revokeAtGoogle: boolean, config?: GoogleConfig, requester: GoogleFetch = googleNetworkFetch): Promise<{ disconnected: boolean; googleRevocation: 'not_requested' | 'succeeded' | 'failed' }> {
  const account = (await database.query<AccountRow & { disconnect_state_hashes: string[] }>(`SELECT *,COALESCE(
    (SELECT array_agg(state_hash) FROM integration_oauth_states WHERE user_id=$1 AND workspace_id=$2 AND service=$3),
    ARRAY[]::text[]) AS disconnect_state_hashes
    FROM integration_accounts WHERE user_id=$1 AND workspace_id=$2 AND service=$3`, [userId, workspaceId, service])).rows[0];
  if (!account) throw new ApiError(409, 'This Google service is not connected for your account in this workspace');
  let googleRevocation: 'not_requested' | 'succeeded' | 'failed' = 'not_requested';
  if (revokeAtGoogle) {
    if (!config) throw new ApiError(503, 'Google OAuth configuration is required to revoke access at Google');
    const encrypted = account.refresh_ciphertext ?? account.access_ciphertext;
    const token = decryptGoogleSecret(encrypted, config.encryptionKey, tokenContext(userId, workspaceId, service, account.refresh_ciphertext ? 'refresh' : 'access'));
    try {
      const response = await requester('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }), redirect: 'error', signal: AbortSignal.timeout(15_000) });
      googleRevocation = response.ok ? 'succeeded' : 'failed';
    } catch { googleRevocation = 'failed'; }
  }
  await database.transaction(async tx => {
    // A revocation request can take long enough for the user to complete a new
    // consent. The stable account ID is reused by consent replacement, so only
    // delete the exact credential generation that this disconnect reviewed.
    const removed = await tx.query('DELETE FROM integration_accounts WHERE id=$1 AND user_id=$2 AND workspace_id=$3 AND credential_generation=$4 RETURNING id', [account.id, userId, workspaceId, account.credential_generation]);
    if (!removed.rows.length) throw new ApiError(409, 'The Google connection changed during disconnect. Refresh its current status before disconnecting again.');
    // Cancel only the exact state snapshot read with the credential generation.
    // New flows survive even if created within the same database timestamp tick.
    await tx.query('DELETE FROM integration_oauth_states WHERE user_id=$1 AND workspace_id=$2 AND service=$3 AND state_hash=ANY($4::text[])', [userId, workspaceId, service, account.disconnect_state_hashes]);
  });
  return { disconnected: true, googleRevocation };
}
