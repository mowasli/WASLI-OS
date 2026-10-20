import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ApiError,assertSameOrigin,createSession,currentUser,getSessionFingerprint,hashPassword,login,logout,requireMembership,setupOwner,verifyPassword} from '../src/lib/auth';
import {addMember,changeMember,createProject,createTask,dashboard,deleteProject,deleteTask,getTask,listProjects,listTasks,updateProject,updateTask} from '../src/lib/core';
import {db,openDatabase} from '../src/lib/db';

const isStatus=(status:number)=>(error:unknown)=>error instanceof ApiError&&error.status===status;

test('persistent PostgreSQL engine, authorization, sessions and linked project workflows',async t=>{
 const rootDirectory=await mkdtemp(path.join(os.tmpdir(),'wasli-core-'));
 const directory=path.join(rootDirectory,'nested','database');
 process.env.WASLI_DATA_DIR=directory;
 process.env.ALLOW_LOCAL_AUTH='true';
 globalThis.wasliDatabase=undefined;
 const password='Testing-only-password-4821';
 const owner=await setupOwner({email:'owner@example.invalid',name:'Test Owner',password});
 let projectId=''; let taskId=''; let thvTaskId=''; let editorId=''; let viewerId='';
 try {
  await t.test('setup creates only workspace definitions and cannot be repeated',async()=>{
   assert.equal((await listTasks(owner.id,'wasl')).length,0);
   assert.equal((await listProjects(owner.id,'thv')).length,0);
   await assert.rejects(setupOwner({email:'hijack@example.invalid',name:'Other',password}),isStatus(409));
  });
  await t.test('password derivation is salted and rejects wrong credentials',async()=>{
   const first=await hashPassword(password);const second=await hashPassword(password);
   assert.notEqual(first,second);assert.ok(!first.includes(password));
   assert.equal(await verifyPassword(password,first),true);
   assert.equal(await verifyPassword('incorrect-password-123',first),false);
   assert.equal((await login({email:owner.email,password})).id,owner.id);
   await assert.rejects(login({email:owner.email,password:'incorrect-password-123'}),isStatus(401));
  });
  await t.test('opaque sessions expire/revoke and fingerprint never reveals token',async()=>{
   const token=await createSession(owner.id); const request=new Request('http://localhost/api/auth/session',{headers:{cookie:`wasli_session=${token}`}});
   assert.equal((await currentUser(request))?.id,owner.id);
   assert.equal(getSessionFingerprint(request)?.length,64);assert.notEqual(getSessionFingerprint(request),token);
   const stored=(await (await db()).query<{token_hash:string}>('SELECT token_hash FROM sessions')).rows[0].token_hash;
   assert.notEqual(stored,token);
   await logout(request);assert.equal(await currentUser(request),null);
   const expired=await createSession(owner.id);
   await (await db()).query("UPDATE sessions SET expires_at=now()-interval '1 second'");
   assert.equal(await currentUser(new Request('http://localhost',{headers:{cookie:`wasli_session=${expired}`}})),null);
  });
  await t.test('cookie-authenticated mutations require matching origin',()=>{
   assert.doesNotThrow(()=>assertSameOrigin(new Request('http://localhost/api/tasks',{method:'POST',headers:{origin:'http://localhost'}})));
   assert.throws(()=>assertSameOrigin(new Request('http://localhost/api/tasks',{method:'POST',headers:{origin:'https://attacker.invalid'}})),isStatus(403));
   assert.throws(()=>assertSameOrigin(new Request('http://localhost/api/tasks',{method:'POST'})),isStatus(403));
  });
  await t.test('projects, milestones, task CRUD and date validation persist',async()=>{
   const project=await createProject(owner.id,{workspaceId:'wasl',name:'Verification project',dueDate:'2026-12-31',milestones:[{id:'m1',title:'First checkpoint',dueDate:'2026-12-01',complete:false}]});
   projectId=project.id;assert.equal(project.milestones[0].title,'First checkpoint');
   const task=await createTask(owner.id,{workspaceId:'wasl',projectId,title:'Verify actual persistence',description:'Restricted WASL-only detail',assignee:'Restricted assignee',tags:['private'],dueDate:'2026-11-30',priority:'urgent',important:true});
   taskId=task.id;assert.equal(task.projectId,project.id);
   const updated=await updateTask(owner.id,task.id,{status:'in_progress',estimatedMinutes:90});
   assert.equal(updated.status,'in_progress');assert.equal(updated.estimatedMinutes,90);assert.equal(updated.description,'Restricted WASL-only detail');assert.equal(updated.priority,'urgent');assert.equal(updated.dueDate,'2026-11-30');assert.equal(updated.important,true);assert.deepEqual(updated.tags,['private']);
   const marked=await updateProject(owner.id,project.id,{milestones:[{...project.milestones[0],complete:true}]});assert.equal(marked.milestones[0].complete,true);
   await assert.rejects(createTask(owner.id,{workspaceId:'wasl',title:'Impossible date',dueDate:'2026-02-30'}));
   await assert.rejects(updateTask(owner.id,task.id,{workspaceId:'thv'}));
  });
  await t.test('data survives database shutdown and reopen',async()=>{
   await (await db()).close();globalThis.wasliDatabase=openDatabase(directory);
   const persisted=await getTask(owner.id,taskId);assert.equal(persisted.title,'Verify actual persistence');assert.equal(persisted.estimatedMinutes,90);
   assert.equal((await listProjects(owner.id,'wasl'))[0].milestones[0].complete,true);
  });
  await t.test('workspace-only accounts cannot access another workspace even by object ID',async()=>{
   const editor=await addMember(owner.id,{workspaceId:'thv',email:'editor@example.invalid',name:'Scoped Editor',password,role:'editor'});editorId=editor.id;
   const viewer=await addMember(owner.id,{workspaceId:'thv',email:'viewer@example.invalid',name:'Scoped Viewer',password,role:'viewer'});viewerId=viewer.id;
   const task=await createTask(editor.id,{workspaceId:'thv',title:'THV-only task',description:'THV confidential'});thvTaskId=task.id;
   assert.equal((await listTasks(editor.id,'thv')).length,1);
   await assert.rejects(listTasks(editor.id,'wasl'),isStatus(403));
   await assert.rejects(getTask(editor.id,taskId),isStatus(403));
   await assert.rejects(updateTask(editor.id,taskId,{title:'Attempted overwrite'}),isStatus(403));
   await assert.rejects(deleteTask(editor.id,taskId),isStatus(403));
   assert.equal((await getTask(owner.id,taskId)).title,'Verify actual persistence');
  });
  await t.test('viewer reads but cannot mutate and editor cannot manage members',async()=>{
   assert.equal((await listTasks(viewerId,'thv')).length,1);
   await assert.rejects(createTask(viewerId,{workspaceId:'thv',title:'Forbidden'}),isStatus(403));
   await assert.rejects(updateTask(viewerId,thvTaskId,{status:'done'}),isStatus(403));
   await assert.rejects(deleteTask(viewerId,thvTaskId),isStatus(403));
   await assert.rejects(addMember(editorId,{workspaceId:'thv',email:'other@example.invalid',name:'Other',password,role:'owner'}),isStatus(403));
  });
  await t.test('cross-workspace project and dependency links are rejected',async()=>{
   await assert.rejects(createTask(owner.id,{workspaceId:'thv',projectId,title:'Cross-scope project'}),isStatus(400));
   await assert.rejects(updateTask(owner.id,thvTaskId,{dependencies:[taskId]}),isStatus(400));
   assert.equal((await listTasks(owner.id,'thv')).length,1);
  });
  await t.test('dependencies enforce acyclic graph and prerequisite completion',async()=>{
   const dependent=await createTask(owner.id,{workspaceId:'wasl',title:'Dependent task',dependencies:[taskId]});
   assert.deepEqual(dependent.dependencies,[taskId]);
   await assert.rejects(updateTask(owner.id,taskId,{dependencies:[dependent.id]}),isStatus(400));
   await assert.rejects(updateTask(owner.id,dependent.id,{status:'done'}),isStatus(409));
   await updateTask(owner.id,taskId,{status:'done'});
   assert.equal((await updateTask(owner.id,dependent.id,{status:'done'})).status,'done');
  });
  await t.test('global dashboard exposes only authorized metadata',async()=>{
   const scoped=await dashboard(editorId);assert.ok(scoped.tasks.length>0);assert.ok(scoped.tasks.every(x=>x.workspaceId==='thv'));
   const global=await dashboard(owner.id);const row=global.tasks.find(x=>x.id===taskId)!;
   assert.equal(row.description,'');assert.equal(row.assignee,'');assert.deepEqual(row.tags,[]);assert.deepEqual(row.dependencies,[]);
   assert.equal(global.projects.find(x=>x.id===projectId)?.description,'');assert.deepEqual(global.projects.find(x=>x.id===projectId)?.milestones,[]);
  });
  await t.test('granting an existing account never resets credentials or profile',async()=>{
   const granted=await addMember(owner.id,{workspaceId:'personal',email:'editor@example.invalid',name:'Malicious rename',password:'Replacement-password-999',role:'viewer'});
   assert.equal(granted.id,editorId);assert.equal(granted.name,'Scoped Editor');
   assert.equal((await login({email:'editor@example.invalid',password})).id,editorId);
   await assert.rejects(login({email:'editor@example.invalid',password:'Replacement-password-999'}),isStatus(401));
   assert.equal(await requireMembership(editorId,'personal'),'viewer');
  });
  await t.test('last-owner guard and revocation take effect immediately',async()=>{
   await assert.rejects(changeMember(owner.id,owner.id,'wasl','viewer'),isStatus(409));
   await changeMember(owner.id,viewerId,'thv',null);
   await assert.rejects(listTasks(viewerId,'thv'),isStatus(403));
  });
  await t.test('SQL-looking strings are data and deletion preserves other records',async()=>{
   const title="Robert'); DROP TABLE tasks; --";
   const task=await createTask(owner.id,{workspaceId:'wasl',title});assert.equal(task.title,title);
   await deleteTask(owner.id,task.id);await assert.rejects(getTask(owner.id,task.id),isStatus(404));
   await deleteProject(owner.id,projectId);assert.equal((await getTask(owner.id,taskId)).projectId,null);
   assert.ok((await (await db()).query('SELECT id FROM audit_logs WHERE workspace_id=$1',['wasl'])).rows.length>=8);
  });
 } finally {
  await (await db()).close();globalThis.wasliDatabase=undefined;await rm(rootDirectory,{recursive:true,force:true});
 }
});
