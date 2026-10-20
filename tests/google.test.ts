import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import { openDatabase, type Database } from '../src/lib/db';
import { ApiError } from '../src/lib/auth';
import {
  GOOGLE_SCOPES, GOOGLE_STORAGE_SCHEMA, beginGoogleOAuth, consumeGoogleOAuthState,
  decryptGoogleSecret, disconnectGoogle, encryptGoogleSecret, finishGoogleOAuth,
  googleConfigurationStatus, googleConnectionStatuses, readEncryptionKey,
  readGoogleData, requireGoogleConfig, selectGoogleDriveFiles,
  type GoogleConfig, type GoogleFetch,
} from '../src/lib/google';

const config: GoogleConfig = { clientId: 'test-client-id', clientSecret: 'test-client-secret', redirectUri: 'http://localhost:3000/api/integrations/google/callback', encryptionKey: Buffer.alloc(32, 7) };
const owner = randomUUID(), other = randomUUID();
const binding = { userId: owner, sessionHash: 'test-session-hash' };
let database: Database;
const fakeTokens: GoogleFetch = async () => Response.json({ access_token: 'test-only-access-token', refresh_token: 'test-only-refresh-token', expires_in: 3600, scope: GOOGLE_SCOPES.drive, token_type: 'Bearer' });
before(async () => {
  database = await openDatabase('memory://');
  await database.exec(GOOGLE_STORAGE_SCHEMA);
  await database.query('INSERT INTO app_users(id,email,name) VALUES($1,$2,$3),($4,$5,$6)', [owner, 'owner@example.invalid', 'Owner', other, 'other@example.invalid', 'Other']);
});
after(async () => { await database?.close(); });

test('AES-GCM encrypts tokens and rejects tampering, wrong keys and cross-workspace substitution', () => {
  const ciphertext = encryptGoogleSecret('test-only-private-token', config.encryptionKey, 'owner:wasl:drive');
  assert.ok(!ciphertext.includes('test-only-private-token'));
  assert.equal(decryptGoogleSecret(ciphertext, config.encryptionKey, 'owner:wasl:drive'), 'test-only-private-token');
  assert.throws(() => decryptGoogleSecret(ciphertext, config.encryptionKey, 'owner:thv:drive'));
  assert.throws(() => decryptGoogleSecret(ciphertext, Buffer.alloc(32, 8), 'owner:wasl:drive'));
  const parts = ciphertext.split('.'); const changed = Buffer.from(parts[3], 'base64url'); changed[0] ^= 1; parts[3] = changed.toString('base64url');
  assert.throws(() => decryptGoogleSecret(parts.join('.'), config.encryptionKey, 'owner:wasl:drive'));
  assert.throws(() => readEncryptionKey('invalid'));
  assert.deepEqual(readEncryptionKey(config.encryptionKey.toString('base64')), config.encryptionKey);
});

test('OAuth scopes are service-specific and Drive does not request account-wide read access', () => {
  assert.equal(GOOGLE_SCOPES.drive, 'https://www.googleapis.com/auth/drive.file');
  assert.equal(GOOGLE_SCOPES.gmail, 'https://www.googleapis.com/auth/gmail.readonly');
  assert.equal(GOOGLE_SCOPES.calendar, 'https://www.googleapis.com/auth/calendar.events.readonly');
  assert.ok(!Object.values(GOOGLE_SCOPES).some(scope => /gmail\.send|calendar\.events$|drive\.readonly/.test(scope)));
});

test('OAuth state is encrypted, session/user/workspace bound, single-use and protected by PKCE', async () => {
  const url = new URL(await beginGoogleOAuth(database, binding, 'thv', 'calendar', config));
  assert.equal(url.hostname, 'accounts.google.com');
  assert.equal(url.searchParams.get('scope'), GOOGLE_SCOPES.calendar);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.has('client_secret'), false);
  assert.equal(url.searchParams.has('code_verifier'), false);
  const state = url.searchParams.get('state')!;
  const stored = (await database.query<{ state_hash: string; verifier_ciphertext: string }>('SELECT state_hash,verifier_ciphertext FROM integration_oauth_states')).rows[0];
  assert.notEqual(stored.state_hash, state); assert.ok(stored.verifier_ciphertext.startsWith('v1.'));
  await assert.rejects(consumeGoogleOAuthState(database, state, { ...binding, userId: other }, config), /another session/);
  await assert.rejects(consumeGoogleOAuthState(database, state, { ...binding, sessionHash: 'wrong-session' }, config), /another session/);
  const result = await consumeGoogleOAuthState(database, state, binding, config);
  assert.equal(result.workspaceId, 'thv'); assert.equal(result.service, 'calendar');
  assert.equal(createHash('sha256').update(result.verifier).digest('base64url'), url.searchParams.get('code_challenge'));
  await assert.rejects(consumeGoogleOAuthState(database, state, binding, config), /already used/);
});

test('expired OAuth state cannot be exchanged', async () => {
  const url = new URL(await beginGoogleOAuth(database, binding, 'wasl', 'drive', config));
  await database.query("UPDATE integration_oauth_states SET expires_at=now()-interval '1 second'");
  await assert.rejects(consumeGoogleOAuthState(database, url.searchParams.get('state')!, binding, config), /expired/);
});

test('server token exchange stores encrypted owner/workspace/service credentials, never a fake connection', async () => {
  let calls = 0;
  const requester: GoogleFetch = async (url, init) => {
    calls++;
    assert.equal(String(url), 'https://oauth2.googleapis.com/token');
    const body = init?.body as URLSearchParams;
    assert.equal(body.get('code_verifier'), 'test-pkce-verifier');
    assert.equal(body.get('redirect_uri'), config.redirectUri);
    return fakeTokens(url, init);
  };
  await finishGoogleOAuth(database, owner, 'wasl', 'drive', 'test-code', 'test-pkce-verifier', config, requester);
  assert.equal(calls, 1);
  const rows = (await database.query<{ access_ciphertext: string; refresh_ciphertext: string }>('SELECT access_ciphertext,refresh_ciphertext FROM integration_accounts WHERE user_id=$1', [owner])).rows;
  assert.equal(rows.length, 1); assert.ok(!JSON.stringify(rows).includes('test-only-access-token')); assert.ok(!JSON.stringify(rows).includes('test-only-refresh-token'));
  const wasl = await googleConnectionStatuses(database, owner, 'wasl') as { service: string; status: string }[];
  assert.equal(wasl.find(x => x.service === 'drive')?.status, 'connected');
  const thv = await googleConnectionStatuses(database, owner, 'thv') as { status: string }[];
  assert.ok(thv.every(x => x.status === 'disconnected'));
  const anotherUser = await googleConnectionStatuses(database, other, 'wasl') as { status: string }[];
  assert.ok(anotherUser.every(x => x.status === 'disconnected'));
  await assert.rejects(finishGoogleOAuth(database, owner, 'wasl', 'gmail', 'test-code', 'test-verifier', config, fakeTokens), /permission was not granted/);
});

test('Drive retrieval requires explicit document selection and cannot retrieve another owner or workspace', async () => {
  const neverFetch: GoogleFetch = async () => { throw new Error('Network must not be reached'); };
  await assert.rejects(readGoogleData(database, owner, 'wasl', 'drive', '', null, config, neverFetch), /No Drive documents are authorized/);
  await assert.rejects(readGoogleData(database, owner, 'thv', 'drive', '', null, config, neverFetch), /not connected/);
  await assert.rejects(readGoogleData(database, other, 'wasl', 'drive', '', null, config, neverFetch), /not connected/);
  assert.equal(await selectGoogleDriveFiles(database, owner, 'wasl', ['selected_document_123', 'selected_document_123']), 1);
  await assert.rejects(readGoogleData(database, owner, 'wasl', 'drive', '', 'unselected_document_123', config, neverFetch), /not selected/);
  let requests = 0;
  const requester: GoogleFetch = async (input, init) => {
    requests++;
    const url = new URL(String(input));
    assert.equal(url.pathname, '/drive/v3/files/selected_document_123');
    assert.equal(url.searchParams.get('fields'), 'id,name,mimeType,modifiedTime,webViewLink');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-only-access-token');
    return Response.json({ id: 'selected_document_123', name: 'Unit-test document' });
  };
  const result = await readGoogleData(database, owner, 'wasl', 'drive', '', null, config, requester) as { indexed: boolean; metadataOnly: boolean; files: unknown[] };
  assert.equal(requests, 1); assert.equal(result.indexed, false); assert.equal(result.metadataOnly, true); assert.equal(result.files.length, 1);
});

test('new OAuth consent without a refresh token replaces old credentials and clears prior Drive selections', async () => {
  const previous = (await database.query<{ refresh_ciphertext: string; credential_generation: string }>("SELECT refresh_ciphertext,credential_generation FROM integration_accounts WHERE user_id=$1 AND workspace_id='wasl' AND service='drive'", [owner])).rows[0];
  assert.ok(previous.refresh_ciphertext);
  assert.equal((await database.query('SELECT file_id FROM integration_drive_files')).rows.length, 1);
  const replacement: GoogleFetch = async () => Response.json({ access_token: 'new-consent-only-access', expires_in: 3600, scope: GOOGLE_SCOPES.drive });
  await finishGoogleOAuth(database, owner, 'wasl', 'drive', 'new-consent-code', 'new-verifier', config, replacement);
  const current = (await database.query<{ refresh_ciphertext: string | null; credential_generation: string }>("SELECT refresh_ciphertext,credential_generation FROM integration_accounts WHERE user_id=$1 AND workspace_id='wasl' AND service='drive'", [owner])).rows[0];
  assert.equal(current.refresh_ciphertext, null);
  assert.notEqual(current.credential_generation, previous.credential_generation);
  assert.equal((await database.query('SELECT file_id FROM integration_drive_files')).rows.length, 0);
  await database.query("UPDATE integration_accounts SET expires_at=now()-interval '1 second' WHERE workspace_id='wasl'");
  let refreshCalls = 0;
  const mustNotRefresh: GoogleFetch = async () => { refreshCalls++; throw new Error('Old refresh token must not be used'); };
  await assert.rejects(readGoogleData(database, owner, 'wasl', 'drive', '', null, config, mustNotRefresh), /expired/);
  assert.equal(refreshCalls, 0);
  await finishGoogleOAuth(database, owner, 'wasl', 'drive', 'new-consent-code', 'new-verifier', config, fakeTokens);
  await selectGoogleDriveFiles(database, owner, 'wasl', ['reselected_document_123']);
});

test('a refresh grant may preserve its own refresh token without replacing its authorization generation', async () => {
  const initial: GoogleFetch = async () => Response.json({ access_token: 'calendar-access', refresh_token: 'calendar-refresh', expires_in: 3600, scope: GOOGLE_SCOPES.calendar });
  await finishGoogleOAuth(database, owner, 'thv', 'calendar', 'test-code', 'test-verifier', config, initial);
  const previous = (await database.query<{ refresh_ciphertext: string; credential_generation: string }>("SELECT refresh_ciphertext,credential_generation FROM integration_accounts WHERE workspace_id='thv'", [])).rows[0];
  await database.query("UPDATE integration_accounts SET expires_at=now()-interval '1 second' WHERE workspace_id='thv'");
  const refresh: GoogleFetch = async (input, init) => {
    if (String(input) === 'https://oauth2.googleapis.com/token') {
      assert.equal((init?.body as URLSearchParams).get('grant_type'), 'refresh_token');
      assert.equal((init?.body as URLSearchParams).get('refresh_token'), 'calendar-refresh');
      return Response.json({ access_token: 'refreshed-calendar-access', expires_in: 3600 });
    }
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer refreshed-calendar-access');
    return Response.json({ items: [] });
  };
  await readGoogleData(database, owner, 'thv', 'calendar', '', null, config, refresh);
  const current = (await database.query<{ refresh_ciphertext: string; credential_generation: string }>("SELECT refresh_ciphertext,credential_generation FROM integration_accounts WHERE workspace_id='thv'", [])).rows[0];
  assert.equal(current.refresh_ciphertext, previous.refresh_ciphertext);
  assert.equal(current.credential_generation, previous.credential_generation);
  await disconnectGoogle(database, owner, 'thv', 'calendar', false);
});

test('an in-flight old refresh cannot overwrite a newer consent or resurrect a disconnected account', async () => {
  const initial: GoogleFetch = async () => Response.json({ access_token: 'old-calendar-access', refresh_token: 'old-calendar-refresh', expires_in: 3600, scope: GOOGLE_SCOPES.calendar });
  for (const action of ['replace', 'disconnect'] as const) {
    await finishGoogleOAuth(database, owner, 'thv', 'calendar', 'test-code', 'test-verifier', config, initial);
    await database.query("UPDATE integration_accounts SET expires_at=now()-interval '1 second' WHERE workspace_id='thv'");
    let release!: () => void, started!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const requested = new Promise<void>(resolve => { started = resolve; });
    const delayed: GoogleFetch = async () => { started(); await waiting; return Response.json({ access_token: 'stale-refresh-result', expires_in: 3600 }); };
    const oldRequest = readGoogleData(database, owner, 'thv', 'calendar', '', null, config, delayed);
    await requested;
    if (action === 'replace') {
      const replacement: GoogleFetch = async () => Response.json({ access_token: 'current-consent-access', expires_in: 3600, scope: GOOGLE_SCOPES.calendar });
      await finishGoogleOAuth(database, owner, 'thv', 'calendar', 'new-code', 'new-verifier', config, replacement);
    } else await disconnectGoogle(database, owner, 'thv', 'calendar', false);
    release();
    await assert.rejects(oldRequest, /connection changed during refresh/);
    if (action === 'replace') {
      const currentOnly: GoogleFetch = async (_input, init) => {
        assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer current-consent-access');
        return Response.json({ items: [] });
      };
      await readGoogleData(database, owner, 'thv', 'calendar', '', null, config, currentOnly);
      const current = (await database.query<{ refresh_ciphertext: string | null }>("SELECT refresh_ciphertext FROM integration_accounts WHERE workspace_id='thv'")).rows[0];
      assert.equal(current.refresh_ciphertext, null);
      await disconnectGoogle(database, owner, 'thv', 'calendar', false);
    } else assert.equal((await database.query("SELECT id FROM integration_accounts WHERE workspace_id='thv'")).rows.length, 0);
  }
});

test('expired and revoked tokens report reconnect_required instead of a successful live connection', async () => {
  const calendarTokens: GoogleFetch = async () => Response.json({ access_token: 'test-calendar-token', refresh_token: 'test-calendar-refresh', expires_in: 3600, scope: GOOGLE_SCOPES.calendar });
  await finishGoogleOAuth(database, owner, 'thv', 'calendar', 'test-code', 'test-verifier', config, calendarTokens);
  await database.query("UPDATE integration_accounts SET expires_at=now()-interval '1 second' WHERE workspace_id='thv'");
  let statuses = await googleConnectionStatuses(database, owner, 'thv') as { service: string; status: string }[];
  assert.equal(statuses.find(x => x.service === 'calendar')?.status, 'refresh_pending');
  const revoked: GoogleFetch = async () => Response.json({ error: 'invalid_grant' }, { status: 400 });
  await assert.rejects(readGoogleData(database, owner, 'thv', 'calendar', '', null, config, revoked), /Reconnect/);
  statuses = await googleConnectionStatuses(database, owner, 'thv') as { service: string; status: string }[];
  assert.equal(statuses.find(x => x.service === 'calendar')?.status, 'reconnect_required');
  await disconnectGoogle(database, owner, 'thv', 'calendar', false);
});

test('failed Google revocation is reported while local disconnect removes encrypted tokens and document selection', async () => {
  const failed: GoogleFetch = async () => new Response(null, { status: 503 });
  const result = await disconnectGoogle(database, owner, 'wasl', 'drive', true, config, failed);
  assert.deepEqual(result, { disconnected: true, googleRevocation: 'failed' });
  assert.equal((await database.query('SELECT id FROM integration_accounts')).rows.length, 0);
  assert.equal((await database.query('SELECT file_id FROM integration_drive_files')).rows.length, 0);
});

test('a stale disconnect cannot delete newer consent credentials, selections or pending OAuth states', async () => {
  await finishGoogleOAuth(database, owner, 'wasl', 'drive', 'initial-code', 'initial-verifier', config, fakeTokens);
  await selectGoogleDriveFiles(database, owner, 'wasl', ['old_selection_123']);
  let release!: () => void, started!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { started = resolve; });
  const delayedRevoke: GoogleFetch = async (input) => {
    assert.equal(String(input), 'https://oauth2.googleapis.com/revoke');
    started(); await waiting; return new Response(null, { status: 200 });
  };
  const disconnect = disconnectGoogle(database, owner, 'wasl', 'drive', true, config, delayedRevoke);
  // Attach the rejection handler before releasing the asynchronous request.
  const rejected = assert.rejects(disconnect, error => error instanceof ApiError && error.status === 409 && /changed during disconnect/.test(error.message));
  await requested;
  const replacement: GoogleFetch = async () => Response.json({ access_token: 'new-disconnect-race-access', refresh_token: 'new-disconnect-race-refresh', expires_in: 3600, scope: GOOGLE_SCOPES.drive });
  await finishGoogleOAuth(database, owner, 'wasl', 'drive', 'replacement-code', 'replacement-verifier', config, replacement);
  await selectGoogleDriveFiles(database, owner, 'wasl', ['new_selection_123']);
  const pending = new URL(await beginGoogleOAuth(database, binding, 'wasl', 'drive', config));
  release(); await rejected;
  const current = (await database.query<{ access_ciphertext: string }>("SELECT access_ciphertext FROM integration_accounts WHERE user_id=$1 AND workspace_id='wasl' AND service='drive'", [owner])).rows[0];
  assert.ok(current, 'The new consent must survive the stale disconnect');
  assert.equal(decryptGoogleSecret(current.access_ciphertext, config.encryptionKey, `google:${owner}:wasl:drive:access`), 'new-disconnect-race-access');
  assert.deepEqual((await database.query<{ file_id: string }>('SELECT file_id FROM integration_drive_files')).rows.map(row => row.file_id), ['new_selection_123']);
  assert.equal((await consumeGoogleOAuthState(database, pending.searchParams.get('state')!, binding, config)).workspaceId, 'wasl');
  await disconnectGoogle(database, owner, 'wasl', 'drive', false);
});

test('disconnect cancels only OAuth states that existed before remote revocation began', async () => {
  await finishGoogleOAuth(database, owner, 'wasl', 'drive', 'initial-code', 'initial-verifier', config, fakeTokens);
  const oldPending = new URL(await beginGoogleOAuth(database, binding, 'wasl', 'drive', config));
  let release!: () => void, started!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { started = resolve; });
  const delayedRevoke: GoogleFetch = async () => { started(); await waiting; return new Response(null, { status: 200 }); };
  const disconnect = disconnectGoogle(database, owner, 'wasl', 'drive', true, config, delayedRevoke);
  await requested;
  const newPending = new URL(await beginGoogleOAuth(database, binding, 'wasl', 'drive', config));
  release();
  assert.deepEqual(await disconnect, { disconnected: true, googleRevocation: 'succeeded' });
  assert.equal((await database.query("SELECT id FROM integration_accounts WHERE user_id=$1 AND workspace_id='wasl' AND service='drive'", [owner])).rows.length, 0);
  await assert.rejects(consumeGoogleOAuthState(database, oldPending.searchParams.get('state')!, binding, config), /already used/);
  assert.equal((await consumeGoogleOAuthState(database, newPending.searchParams.get('state')!, binding, config)).workspaceId, 'wasl');
});

test('missing configuration reports exact variable names without initiating OAuth or revealing values', () => {
  const names = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'TOKEN_ENCRYPTION_KEY'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    assert.deepEqual(googleConfigurationStatus(), { configured: false, missing: names, invalid: [] });
    assert.throws(requireGoogleConfig, /Google OAuth is not configured/);
    process.env.GOOGLE_REDIRECT_URI = 'http://external.example/api/integrations/google/callback';
    process.env.TOKEN_ENCRYPTION_KEY = 'invalid';
    assert.deepEqual(googleConfigurationStatus().invalid, ['GOOGLE_REDIRECT_URI', 'TOKEN_ENCRYPTION_KEY']);
  } finally {
    for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
  }
});
