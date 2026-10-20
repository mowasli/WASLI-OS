import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ApiError } from '../src/lib/auth';
import { openDatabase } from '../src/lib/db';
import { approveSop, createOperation, deleteOperation, ensureOperationsStorage, listOperations, updateOperation, type Sop, type OperationRecord } from '../src/lib/operations';
const status=(n:number)=>(e:unknown)=>e instanceof ApiError&&e.status===n;

test('specialist operations enforce workspace roles, persist records and preserve SOP approval history',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'wasli-operations-'));const database=await openDatabase(directory);await ensureOperationsStorage(database,true);
 const owner=randomUUID(),editor=randomUUID(),viewer=randomUUID(),waslOnly=randomUUID();
 for(const [id,name]of [[owner,'owner'],[editor,'editor'],[viewer,'viewer'],[waslOnly,'wasl']])await database.query('INSERT INTO app_users(id,email,name) VALUES($1,$2,$3)',[id,`${name}@example.invalid`,name]);
 for(const [id,workspace,role]of [[owner,'thv','owner'],[owner,'independent','owner'],[owner,'personal','owner'],[editor,'thv','editor'],[viewer,'thv','viewer'],[waslOnly,'wasl','owner']])await database.query('INSERT INTO workspace_memberships(user_id,workspace_id,role) VALUES($1,$2,$3)',[id,workspace,role]);
 let sop:Sop;let contact:OperationRecord;
 try{
  await t.test('starts empty and creates genuine scoped records',async()=>{
   assert.deepEqual(await listOperations(owner,'thv',database),{sops:[],records:[]});
   contact=await createOperation(editor,{workspaceId:'thv',kind:'contact',title:'Test stakeholder',notes:'THV-private context'},database) as OperationRecord;
   assert.equal(contact.notes,'THV-private context');
   await assert.rejects(listOperations(waslOnly,'thv',database),status(403));
   await assert.rejects(updateOperation(waslOnly,contact.id,{notes:'leak'},database),status(403));
   await assert.rejects(deleteOperation(viewer,contact.id,database),status(403));
   assert.equal((await listOperations(viewer,'thv',database)).records.length,1);
  });
  await t.test('THV editor drafts SOP, owner approves, approved rows are immutable',async()=>{
   sop=await createOperation(editor,{workspaceId:'thv',kind:'sop',title:'Verified process draft',category:'softlanding',content:'Objective: review evidence. Owner: assigned after review.'},database) as Sop;
   assert.equal(sop.currentVersion,1);assert.equal(sop.versions[0].status,'draft');
   await assert.rejects(approveSop(editor,sop.id,sop.currentVersion,database),status(403));
   await assert.rejects(approveSop(waslOnly,sop.id,sop.currentVersion,database),status(403));
   sop=await approveSop(owner,sop.id,sop.currentVersion,database);assert.equal(sop.versions[0].status,'approved');assert.equal(sop.versions[0].approvedBy,owner);
   await assert.rejects(database.query('UPDATE sop_versions SET content=$2 WHERE id=$1',[sop.versions[0].id,'tampered']),/immutable/);
   await assert.rejects(database.query('DELETE FROM sop_versions WHERE id=$1',[sop.versions[0].id]),/immutable/);
   await assert.rejects(approveSop(owner,sop.id,sop.currentVersion,database),status(409));
  });
  await t.test('editing approved process creates distinct draft and retains earlier approval',async()=>{
   sop=await updateOperation(editor,sop.id,{kind:'sop',content:'Revised objective with explicit quality checks.'},database) as Sop;
   assert.equal(sop.currentVersion,2);assert.equal(sop.versions.length,2);assert.equal(sop.versions[0].status,'draft');assert.equal(sop.versions[1].status,'approved');assert.match(sop.versions[1].content,/review evidence/);
   // The owner reviewed version1 before the editor saved version2. A stale
   // approval must not silently approve the latest unreviewed content.
   await assert.rejects(approveSop(owner,sop.id,1,database),status(409));
   const afterStale=(await listOperations(owner,'thv',database)).sops.find(s=>s.id===sop.id)!;
   assert.equal(afterStale.versions[0].status,'draft');assert.equal(afterStale.versions[0].approvedBy,null);
   sop=await approveSop(owner,sop.id,2,database);
   assert.equal(sop.versions[0].status,'approved');assert.equal(sop.versions[0].approvedBy,owner);assert.equal(sop.versions[1].status,'approved');
   await assert.rejects(updateOperation(viewer,sop.id,{kind:'sop',content:'forbidden'},database),status(403));
   sop=await updateOperation(owner,sop.id,{kind:'sop',archived:true},database) as Sop;assert.equal(sop.archived,true);
   await assert.rejects(approveSop(owner,sop.id,sop.currentVersion,database),status(409));
   await assert.rejects(deleteOperation(owner,sop.id,database),status(404));
  });
  await t.test('workspace-specific types and dates are validated',async()=>{
   await assert.rejects(createOperation(owner,{workspaceId:'personal',kind:'startup',title:'Wrong scope'},database),status(400));
   await assert.rejects(createOperation(owner,{workspaceId:'personal',kind:'contact',title:'Wrong category',category:'volunteer'},database),status(400));
   await assert.rejects(createOperation(owner,{workspaceId:'personal',kind:'content',title:'Invalid date',dueDate:'2026-02-30'},database));
   const engagement=await createOperation(owner,{workspaceId:'independent',kind:'engagement',title:'Test volunteer commitment',category:'volunteer',dueDate:'2026-12-01'},database) as OperationRecord;
   assert.equal(engagement.category,'volunteer');assert.equal((await listOperations(owner,'personal',database)).records.length,0);
   await updateOperation(owner,engagement.id,{status:'completed'},database);assert.equal((await listOperations(owner,'independent',database)).records[0].status,'completed');
   await deleteOperation(owner,engagement.id,database);assert.equal((await listOperations(owner,'independent',database)).records.length,0);
  });
  await t.test('partial record updates preserve every unspecified persisted field',async()=>{
   const original=await createOperation(owner,{workspaceId:'independent',kind:'engagement',title:'Original engagement',organization:'Independent client',email:'contact@example.invalid',notes:'Private contractual context',dueDate:'2026-12-17',status:'waiting',category:'volunteer'},database) as OperationRecord;
   const renamed=await updateOperation(owner,original.id,{title:'Renamed engagement'},database) as OperationRecord;
   for(const field of ['id','workspaceId','kind','organization','email','notes','dueDate','status','category','createdAt'] as const)assert.deepEqual(renamed[field],original[field],`${field} must survive a title-only PATCH`);
   assert.equal(renamed.title,'Renamed engagement');
   const completed=await updateOperation(owner,original.id,{status:'completed'},database) as OperationRecord;
   assert.equal(completed.title,'Renamed engagement');assert.equal(completed.organization,original.organization);assert.equal(completed.email,original.email);assert.equal(completed.notes,original.notes);assert.equal(completed.dueDate,original.dueDate);assert.equal(completed.category,'volunteer');assert.equal(completed.status,'completed');
   const cleared=await updateOperation(owner,original.id,{notes:'',dueDate:null},database) as OperationRecord;
   assert.equal(cleared.notes,'');assert.equal(cleared.dueDate,null);assert.equal(cleared.organization,original.organization);assert.equal(cleared.category,'volunteer');assert.equal(cleared.status,'completed');
  });
  await t.test('mutations leave auditable events',async()=>{const rows=(await database.query('SELECT action FROM audit_logs WHERE workspace_id=$1',['thv'])).rows;assert.ok(rows.some(r=>r.action==='sop.approved'));assert.ok(rows.some(r=>r.action==='sop.versioned'));});
 }finally{await database.close();await rm(directory,{recursive:true,force:true});}
});
