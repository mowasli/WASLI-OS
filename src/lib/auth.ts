import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { db, type Database } from './db';
import type { Role, User, Workspace, WorkspaceId } from './types';
import { credentialsSchema, setupSchema, workspaceIdSchema } from './validation';
import { authenticateSupabase, supabaseAuthConfigured, SupabaseSignInError, type SupabaseIdentity } from './supabase-auth';

export const SESSION_COOKIE = 'wasli_session';
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export function respondError(error: unknown): NextResponse {
  if (error instanceof ApiError) return NextResponse.json({error:error.message},{status:error.status});
  if (error instanceof ZodError) return NextResponse.json({error:error.issues.map(x=>`${x.path.join('.') || 'input'}: ${x.message}`).join('; ')},{status:400});
  console.error('WASLI request failed:', error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted database URL]') : 'Unknown error');
  return NextResponse.json({error:'The operation could not be completed. Please retry.'},{status:500});
}
export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new ApiError(415,'Expected application/json');
  if (Number(request.headers.get('content-length') || 0) > 100_000) throw new ApiError(413,'Request is too large');
  const body = await request.text();
  if (body.length > 100_000) throw new ApiError(413,'Request is too large');
  try { return JSON.parse(body); } catch { throw new ApiError(400,'Invalid JSON'); }
}
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin) throw new ApiError(403,'This action requires a same-origin request');
  let expected: string;
  const configured = process.env.WASLI_APP_ORIGIN?.trim();
  if (configured) {
    let canonical: URL;
    try { canonical = new URL(configured); } catch { throw new ApiError(503,'WASLI_APP_ORIGIN must be a valid canonical application origin'); }
    const loopback = ['localhost','127.0.0.1','[::1]'].includes(canonical.hostname);
    if (canonical.username || canonical.password || canonical.pathname !== '/' || canonical.search || canonical.hash ||
        (canonical.protocol !== 'https:' && !(loopback && canonical.protocol === 'http:'))) {
      throw new ApiError(503,'WASLI_APP_ORIGIN must use HTTPS (HTTP loopback is allowed) and contain no path, credentials, query or fragment');
    }
    expected = canonical.origin;
  } else {
    // Production reverse proxies must configure a trusted canonical origin. Never
    // infer an allowed production origin from attacker-controlled forwarded headers.
    if (process.env.NODE_ENV === 'production') throw new ApiError(503,'Configure WASLI_APP_ORIGIN before enabling production mutations');
    const internal = new URL(request.url);
    const host = request.headers.get('host') ?? internal.host;
    if (!host || /[\s/@\\?#,]/.test(host) || !['http:','https:'].includes(internal.protocol)) throw new ApiError(403,'Invalid request host');
    // Next development may rewrite Request.url to its internal listening address.
    // The browser Host retains the actual same-origin address. Ignore X-Forwarded-*.
    try { expected = new URL(`${internal.protocol}//${host}`).origin; }
    catch { throw new ApiError(403,'Invalid request host'); }
  }
  if (origin !== expected) throw new ApiError(403,'This action requires a same-origin request');
}
export function authenticationProvider(): 'local' | 'supabase' | 'disabled' {
  if (process.env.WASLI_AUTH_PROVIDER === 'supabase') return 'supabase';
  if (process.env.WASLI_AUTH_PROVIDER && process.env.WASLI_AUTH_PROVIDER !== 'local') return 'disabled';
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_LOCAL_AUTH === 'true' ? 'local' : 'disabled';
}
export function localAuthEnabled(): boolean { return authenticationProvider() === 'local'; }
export function authenticationEnabled(): boolean {
  const provider = authenticationProvider();
  return provider === 'local' || (provider === 'supabase' && supabaseAuthConfigured());
}
function requireLocalAuth(): void { if(!localAuthEnabled()) throw new ApiError(503,'Local password authentication is disabled. Configure an approved identity provider before production use.'); }
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(24).toString('base64url');
  const key = await new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:32768,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
  return `scrypt$${salt}$${key.toString('base64url')}`;
}
export async function verifyPassword(password:string,encoded:string):Promise<boolean> {
  const [kind,salt,key] = encoded.split('$');
  if(kind!=='scrypt'||!salt||!key) return false;
  const actual=Buffer.from((await hashWithSalt(password,salt)),'base64url'); const expected=Buffer.from(key,'base64url');
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}
async function hashWithSalt(password:string,salt:string):Promise<string> {
  return new Promise((resolve,reject)=>scrypt(password,salt,64,{N:32768,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key.toString('base64url'))));
}
// Distinct hash domains prevent a local session becoming a managed-auth session
// when an operator changes the provider. Raw tokens remain opaque in both modes.
const digest=(token:string)=>createHash('sha256').update(authenticationProvider()==='supabase'?'supabase:':'').update(token).digest('hex');
export async function createSession(userId:string,lifetimeSeconds=7*24*60*60,providerExpiresAt=Infinity):Promise<string> {
  const maximum=authenticationProvider()==='supabase'?3600:7*24*60*60;
  if(!Number.isInteger(lifetimeSeconds)||lifetimeSeconds<1) throw new ApiError(500,'Invalid session duration');
  const duration=Math.min(lifetimeSeconds,maximum);
  const expiresAt=new Date(Math.min(Date.now()+duration*1000,providerExpiresAt));
  if(!Number.isFinite(expiresAt.getTime())||expiresAt.getTime()<=Date.now()) throw new ApiError(401,'The sign-in token expired. Please sign in again.');
  const token=randomBytes(32).toString('base64url'); const database=await db();
  await database.query('DELETE FROM sessions WHERE expires_at < now()');
  await database.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3::timestamptz)',[digest(token),userId,expiresAt.toISOString()]);
  return token;
}
export function withSession(response:NextResponse,token:string,request:Request,lifetimeSeconds=7*24*60*60):NextResponse {
  const maxAge=Math.min(lifetimeSeconds,authenticationProvider()==='supabase'?3600:7*24*60*60);
  response.cookies.set(SESSION_COOKIE,token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'||new URL(request.url).protocol==='https:',path:'/',maxAge});
  return response;
}
async function tokenFrom(request?:Request):Promise<string|undefined> {
  if(request) {
    const part=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${SESSION_COOKIE}=`));
    return part?.slice(SESSION_COOKIE.length+1);
  }
  const {cookies}=await import('next/headers'); return (await cookies()).get(SESSION_COOKIE)?.value;
}
export async function currentUser(request?:Request):Promise<User|null> {
  if(!authenticationEnabled()) return null;
  const token=await tokenFrom(request); if(!token || !/^[\w-]{43}$/.test(token)) return null;
  const result=await (await db()).query<User>('SELECT u.id,u.email,u.name FROM sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[digest(token)]);
  return result.rows[0]??null;
}
export async function requireUser(request?:Request):Promise<User> { const user=await currentUser(request); if(!user) throw new ApiError(401,'Please sign in'); return user; }
export async function requireMembership(userId:string,workspaceId:string,write=false,database?:Database):Promise<Role> {
  const parsed=workspaceIdSchema.safeParse(workspaceId); if(!parsed.success) throw new ApiError(400,'Invalid workspace');
  const result=await (database??await db()).query<{role:Role}>(`SELECT role FROM workspace_memberships WHERE user_id=$1 AND workspace_id=$2${database ? ' FOR SHARE' : ''}`,[userId,workspaceId]);
  const role=result.rows[0]?.role; if(!role || (write&&role==='viewer')) throw new ApiError(403,'You do not have permission for this workspace');
  return role;
}
export async function listWorkspaces(userId:string):Promise<Workspace[]> {
  return (await (await db()).query<Workspace>('SELECT w.id,w.name,m.role FROM workspaces w JOIN workspace_memberships m ON m.workspace_id=w.id WHERE m.user_id=$1 ORDER BY CASE w.id WHEN \'wasl\' THEN 1 WHEN \'thv\' THEN 2 WHEN \'personal\' THEN 3 ELSE 4 END',[userId])).rows;
}
export async function audit(database:Database,userId:string,workspaceId:WorkspaceId|null,action:string,entityId:string):Promise<void> {
  await database.query('INSERT INTO audit_logs(id,user_id,workspace_id,action,entity_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),userId,workspaceId,action,entityId]);
}
export async function setupOwner(input:unknown):Promise<User> {
  requireLocalAuth(); const data=setupSchema.parse(input); const passwordHash=await hashPassword(data.password); const database=await db();
  return database.transaction(async tx=>{
    await tx.query('SELECT id FROM workspaces ORDER BY id FOR UPDATE');
    if((await tx.query('SELECT id FROM app_users LIMIT 1')).rows.length) throw new ApiError(409,'Initial setup has already been completed');
    const user:User={id:randomUUID(),email:data.email,name:data.name};
    await tx.query('INSERT INTO app_users(id,email,name,password_hash) VALUES($1,$2,$3,$4)',[user.id,user.email,user.name,passwordHash]);
    await tx.query('INSERT INTO workspace_memberships(user_id,workspace_id,role) SELECT $1,id,\'owner\' FROM workspaces',[user.id]);
    await audit(tx,user.id,null,'account.setup',user.id); return user;
  });
}
export async function login(input:unknown):Promise<User> {
  requireLocalAuth(); const data=credentialsSchema.parse(input); const database=await db();
  const recent=await database.query<{failures:number}>('SELECT failures FROM login_attempts WHERE email=$1 AND last_attempt>now()-interval \'15 minutes\'',[data.email]);
  if((recent.rows[0]?.failures??0)>=8) throw new ApiError(429,'Too many sign-in attempts. Try again in 15 minutes.');
  const result=await database.query<User&{password_hash:string|null}>('SELECT id,email,name,password_hash FROM app_users WHERE email=$1',[data.email]);
  const row=result.rows[0];
  // Always perform a password derivation even when no matching user exists.
  const valid=row?.password_hash ? await verifyPassword(data.password,row.password_hash) : (await hashPassword(data.password),false);
  if(!valid) {
    await database.query('INSERT INTO login_attempts(email,failures,last_attempt) VALUES($1,1,now()) ON CONFLICT(email) DO UPDATE SET failures=CASE WHEN login_attempts.last_attempt<now()-interval \'15 minutes\' THEN 1 ELSE login_attempts.failures+1 END,last_attempt=now()',[data.email]);
    throw new ApiError(401,'Email or password is incorrect');
  }
  await database.query('DELETE FROM login_attempts WHERE email=$1',[data.email]);
  return {id:row.id,email:row.email,name:row.name};
}
export async function signIn(input:unknown,verifyIdentity:typeof authenticateSupabase=authenticateSupabase):Promise<{user:User;token:string;lifetimeSeconds:number}> {
  if(authenticationProvider()!=='supabase') {
    const user=await login(input);
    return {user,token:await createSession(user.id),lifetimeSeconds:7*24*60*60};
  }
  if(!supabaseAuthConfigured()) throw new ApiError(503,'Managed sign-in is not configured. Contact the administrator.');
  const data=credentialsSchema.parse(input); const database=await db();
  const recent=await database.query<{failures:number}>('SELECT failures FROM login_attempts WHERE email=$1 AND last_attempt>now()-interval \'15 minutes\'',[data.email]);
  if((recent.rows[0]?.failures??0)>=8) throw new ApiError(429,'Too many sign-in attempts. Try again in 15 minutes.');
  let identity:SupabaseIdentity;
  try { identity=await verifyIdentity(data); }
  catch(error) {
    if(error instanceof SupabaseSignInError) {
      if(error.status===401) await database.query('INSERT INTO login_attempts(email,failures,last_attempt) VALUES($1,1,now()) ON CONFLICT(email) DO UPDATE SET failures=CASE WHEN login_attempts.last_attempt<now()-interval \'15 minutes\' THEN 1 ELSE login_attempts.failures+1 END,last_attempt=now()',[data.email]);
      throw new ApiError(error.status,error.message);
    }
    throw new ApiError(503,'The sign-in provider is unavailable. Try again later.');
  }
  // No email auto-linking, public signup, or first-visitor owner provisioning.
  const result=await database.query<User>('SELECT u.id,u.email,u.name FROM app_users u WHERE u.id=$1 AND lower(u.email)=$2 AND EXISTS(SELECT 1 FROM workspace_memberships m WHERE m.user_id=u.id)',[identity.id,identity.email]);
  const user=result.rows[0];
  if(!user) throw new ApiError(403,'This account has no workspace access. Contact the administrator.');
  await database.query('DELETE FROM login_attempts WHERE email=$1',[data.email]);
  const lifetimeSeconds=Math.min(identity.lifetimeSeconds,3600,Math.floor((identity.expiresAt-Date.now())/1000));
  if(lifetimeSeconds<1) throw new ApiError(401,'The sign-in token expired. Please sign in again.');
  return {user,token:await createSession(user.id,lifetimeSeconds,identity.expiresAt),lifetimeSeconds};
}
export async function logout(request:Request):Promise<void> { const token=await tokenFrom(request); if(token) await (await db()).query('DELETE FROM sessions WHERE token_hash=$1',[digest(token)]); }
/** A non-reversible session binding for OAuth state; never exposes a cookie value. */
export function getSessionFingerprint(request:Request):string|null {
  const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length+1);
  return token && /^[\w-]{43}$/.test(token) ? digest(token) : null;
}
