import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { authenticateSupabase, supabaseAuthConfig, SupabaseSignInError } from '../src/lib/supabase-auth';
import { authenticationProvider, createSession, currentUser, localAuthEnabled, logout, requireMembership, setupOwner, signIn, withSession, ApiError } from '../src/lib/auth';
import { db, openDatabase } from '../src/lib/db';
import { hostingConfigurationIssues } from '../src/lib/hosting';

const config={url:'https://auth.example.invalid',publishableKey:'sb_publishable_fixture_only_123456'};
const credentials={email:'approved@example.invalid',password:'Fixture-only-password-123'};
const identity={id:'79d23c4b-30d2-4fd0-89d7-81472df568f0',email:credentials.email,email_confirmed_at:'2026-10-01T12:00:00+00:00',is_anonymous:false};
const isStatus=(status:number)=>(error:unknown)=>error instanceof SupabaseSignInError&&error.status===status;
function provider(user:unknown=identity,grant:unknown={access_token:'fixture-access-token',expires_in:3600}):typeof fetch {
  return (async(url:unknown)=>Response.json(String(url).includes('/token?')?grant:user)) as typeof fetch;
}

test('managed sign-in verifies the provider token and returns neither provider tokens nor passwords',async()=>{
  const requests:{url:string;init:RequestInit}[]=[];
  const requester=(async(url:unknown,init:RequestInit)=>{
    requests.push({url:String(url),init});
    return Response.json(requests.length===1?{access_token:'provider-token',refresh_token:'provider-refresh',expires_in:3600}:identity);
  }) as typeof fetch;
  const result=await authenticateSupabase(credentials,config,requester);
  assert.equal(result.id,identity.id); assert.equal(result.email,credentials.email);
  assert.ok(result.lifetimeSeconds>3500&&result.lifetimeSeconds<=3600);
  assert.deepEqual(JSON.parse(String(requests[0].init.body)),credentials);
  assert.equal(requests[0].url,config.url+'/auth/v1/token?grant_type=password');
  assert.equal(requests[1].url,config.url+'/auth/v1/user');
  assert.equal(new Headers(requests[1].init.headers).get('authorization'),'Bearer provider-token');
  assert.ok(requests.every(r=>r.init.redirect==='error'&&r.init.cache==='no-store'&&r.init.signal));
  assert.ok(!JSON.stringify(result).includes('provider-token')&&!JSON.stringify(result).includes(credentials.password));
});

test('managed authentication rejects unconfirmed, anonymous, banned, mismatched and MFA accounts',async()=>{
  for(const user of [
    {...identity,email_confirmed_at:null}, {...identity,is_anonymous:true},
    {...identity,banned_until:'2999-01-01T00:00:00Z'}, {...identity,email:'another@example.invalid'},
    {...identity,id:'untrusted-id'},
  ]) await assert.rejects(authenticateSupabase(credentials,config,provider(user)),isStatus(401));
  await assert.rejects(authenticateSupabase(credentials,config,provider({...identity,factors:[{status:'verified'}]})),isStatus(403));
});

test('managed sessions cannot outlive the verified token or one hour',async()=>{
  const token=`fixture.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+60})).toString('base64url')}.signature`;
  const result=await authenticateSupabase(credentials,config,provider(identity,{access_token:token,expires_in:86400}));
  assert.ok(result.lifetimeSeconds>0&&result.lifetimeSeconds<=60);
  const expired=`fixture.${Buffer.from(JSON.stringify({exp:1})).toString('base64url')}.signature`;
  await assert.rejects(authenticateSupabase(credentials,config,provider(identity,{access_token:expired,expires_in:3600})),isStatus(401));
  await assert.rejects(authenticateSupabase(credentials,config,provider(identity,{access_token:'token',expires_in:-1})),isStatus(503));
});

test('provider outages, throttling and malformed responses fail closed without leaking provider details',async()=>{
  for(const [status,expected] of [[400,401],[401,401],[403,401],[429,429],[500,503]]) {
    const requester=(async()=>new Response('sensitive provider details '+credentials.password,{status})) as typeof fetch;
    await assert.rejects(authenticateSupabase(credentials,config,requester),(error:unknown)=>isStatus(expected)(error)&&!(error as Error).message.includes(credentials.password));
  }
  await assert.rejects(authenticateSupabase(credentials,config,(async()=>{throw new Error(credentials.password);}) as typeof fetch),isStatus(503));
  await assert.rejects(authenticateSupabase(credentials,config,(async()=>new Response('not json')) as typeof fetch),isStatus(503));
  await assert.rejects(authenticateSupabase(credentials,config,provider(identity,{})),isStatus(503));
});

test('hosting preflight reports safe configuration issues and rejects elevated identity keys',()=>{
  const valid={WASLI_AUTH_PROVIDER:'supabase',SUPABASE_URL:config.url,SUPABASE_PUBLISHABLE_KEY:config.publishableKey,
    WASLI_APP_ORIGIN:'https://portal.example.invalid',DATABASE_URL:'postgresql://wasli_user:private_password@pool.example.invalid:6543/postgres'};
  assert.deepEqual(hostingConfigurationIssues(valid,24),[]);
  for(const changes of [
    {SUPABASE_URL:'http://auth.example.invalid'}, {SUPABASE_URL:config.url+'/path'},
    {SUPABASE_PUBLISHABLE_KEY:'sb_secret_fixture'}, {DATABASE_URL:'postgresql://user:password@localhost/db'},
    {DATABASE_URL:valid.DATABASE_URL+'?sslmode=disable'}, {WASLI_APP_ORIGIN:'http://portal.example.invalid'},
    {WASLI_APP_ORIGIN:'https://portal.example.invalid/path'}, {WASLI_AUTH_PROVIDER:'local'},
    {ALLOW_LOCAL_AUTH:'true'}, {WASLI_DATA_DIR:'.data/wasli'},
  ]) assert.ok(hostingConfigurationIssues({...valid,...changes},24).length>0);
  assert.ok(hostingConfigurationIssues(valid,20).length>0);
  const issues=hostingConfigurationIssues({...valid,SUPABASE_PUBLISHABLE_KEY:'sb_secret_MUST_NOT_BE_PRINTED',DATABASE_URL:'bad://MUST_NOT_BE_PRINTED'},24).join('\n');
  assert.ok(!issues.includes('MUST_NOT_BE_PRINTED'));
  assert.throws(()=>supabaseAuthConfig({SUPABASE_URL:config.url,SUPABASE_PUBLISHABLE_KEY:'sb_secret_elevated'}),isStatus(503));
});

test('managed identity requires explicit ID membership, isolates local sessions, limits expiry and revokes logout',async()=>{
  const keys=['WASLI_AUTH_PROVIDER','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','ALLOW_LOCAL_AUTH','WASLI_DATA_DIR','DATABASE_URL','NODE_ENV'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const root=await mkdtemp(path.join(os.tmpdir(),'wasli-hosted-auth-'));
  try {
    delete process.env.WASLI_AUTH_PROVIDER; delete process.env.DATABASE_URL;
    process.env.ALLOW_LOCAL_AUTH='true'; process.env.WASLI_DATA_DIR=root;
    globalThis.wasliDatabase=undefined;
    const owner=await setupOwner({...credentials,name:'Provisioned owner'});
    const localToken=await createSession(owner.id);
    Object.assign(process.env,{WASLI_AUTH_PROVIDER:'supabase',SUPABASE_URL:config.url,SUPABASE_PUBLISHABLE_KEY:config.publishableKey});
    assert.equal(authenticationProvider(),'supabase'); assert.equal(localAuthEnabled(),false);
    const request=(token:string)=>new Request('https://portal.example.invalid',{headers:{cookie:`wasli_session=${token}`}});
    assert.equal(await currentUser(request(localToken)),null);
    await assert.rejects(setupOwner({...credentials,name:'Unapproved owner'}),(e:unknown)=>e instanceof ApiError&&e.status===503);
    await assert.rejects(signIn(credentials,async()=>({...identity,lifetimeSeconds:1800,expiresAt:Date.now()+1800_000})),(e:unknown)=>e instanceof ApiError&&e.status===403);
    await (await db()).query('INSERT INTO login_attempts(email,failures,last_attempt) VALUES($1,8,now())',[credentials.email]);
    let providerCalled=false;
    await assert.rejects(signIn(credentials,async()=>{providerCalled=true;return {...identity,lifetimeSeconds:1800,expiresAt:Date.now()+1800_000};}),(e:unknown)=>e instanceof ApiError&&e.status===429);
    assert.equal(providerCalled,false);
    await (await db()).query('DELETE FROM login_attempts WHERE email=$1',[credentials.email]);
    await assert.rejects(signIn(credentials,async()=>({id:owner.id,email:owner.email,lifetimeSeconds:1800,expiresAt:Date.now()-1})),(e:unknown)=>e instanceof ApiError&&e.status===401);
    const verifier=async()=>({id:owner.id,email:owner.email,lifetimeSeconds:1800,expiresAt:Date.now()+1800_000});
    const session=await signIn(credentials,verifier);
    assert.equal((await currentUser(request(session.token)))?.id,owner.id);
    const stored=(await (await db()).query<{seconds:number;token_hash:string}>('SELECT token_hash,extract(epoch FROM (expires_at-now()))::integer AS seconds FROM sessions WHERE user_id=$1 AND expires_at<now()+interval \'1 hour\'',[owner.id])).rows[0];
    assert.ok(stored.seconds<=1800&&stored.seconds>1700); assert.notEqual(stored.token_hash,session.token);
    Object.assign(process.env,{NODE_ENV:'production'});
    const response=withSession(NextResponse.json({user:owner}),session.token,request(session.token),session.lifetimeSeconds);
    const cookie=response.headers.get('set-cookie')!;
    assert.match(cookie,/HttpOnly/i); assert.match(cookie,/Secure/i); assert.ok(cookie.includes(`Max-Age=${session.lifetimeSeconds}`));
    await (await db()).query('DELETE FROM workspace_memberships WHERE user_id=$1 AND workspace_id=$2',[owner.id,'thv']);
    await assert.rejects(requireMembership(owner.id,'thv'),(e:unknown)=>e instanceof ApiError&&e.status===403);
    assert.equal(await requireMembership(owner.id,'wasl'),'owner');
    await logout(request(session.token)); assert.equal(await currentUser(request(session.token)),null);
    delete process.env.WASLI_AUTH_PROVIDER;
    assert.equal(await currentUser(request(session.token)),null);
    assert.equal((await (await db()).query('SELECT id FROM app_users')).rows.length,1);
  } finally {
    await globalThis.wasliDatabase?.then(database=>database.close());globalThis.wasliDatabase=undefined;
    for(const key of keys) {if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
    await rm(root,{recursive:true,force:true});
  }
});

test('production and Vercel cannot silently use embedded development storage',async()=>{
  const keys=['NODE_ENV','DATABASE_URL','VERCEL'];const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try {
    delete process.env.DATABASE_URL; Object.assign(process.env,{NODE_ENV:'production'});
    await assert.rejects(openDatabase(),/requires DATABASE_URL/);
    Object.assign(process.env,{NODE_ENV:'development',VERCEL:'1'});
    await assert.rejects(openDatabase(),/requires DATABASE_URL/);
  } finally {for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
});

test('prepared owner SQL rejects an unverified identity even when an app profile already exists',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'wasli-owner-sql-'));
  const database=await openDatabase(path.join(root,'database'));
  try {
    await database.exec('CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,is_anonymous boolean)');
    await database.query('INSERT INTO auth.users VALUES($1,$2,now(),false)',[identity.id,credentials.email]);
    const otherId='467ce2e1-4043-401c-8f04-e75effda67de';
    await database.query('INSERT INTO app_users(id,email,name) VALUES($1,$2,$3)',[otherId,'unverified@example.invalid','Unverified existing profile']);
    const template=await readFile(path.join(process.cwd(),'supabase/hosting/provision-owner.sql'),'utf8');
    // psql performs quoted literal substitution in the actual operator workflow.
    const sql=(id:string,email:string)=>template.replaceAll(":'owner_id'",`'${id}'`).replaceAll(":'owner_email'",`'${email}'`).replaceAll(":'owner_name'","'Fixture owner'");
    await assert.rejects(database.exec(sql(otherId,'unverified@example.invalid')));
    await database.query('ROLLBACK');
    assert.equal((await database.query('SELECT * FROM workspace_memberships WHERE user_id=$1',[otherId])).rows.length,0);
    await assert.rejects(database.exec(sql(identity.id,'incorrect@example.invalid')));
    await database.query('ROLLBACK');
    await database.exec(sql(identity.id,credentials.email));
    const memberships=await database.query<{role:string}>('SELECT role FROM workspace_memberships WHERE user_id=$1',[identity.id]);
    assert.equal(memberships.rows.length,4);assert.ok(memberships.rows.every(row=>row.role==='owner'));
    const owner=(await database.query<{password_hash:string|null}>('SELECT password_hash FROM app_users WHERE id=$1',[identity.id])).rows[0];
    assert.equal(owner.password_hash,null);
  } finally {await database.close();await rm(root,{recursive:true,force:true});}
});
