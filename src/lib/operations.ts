import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ApiError, audit, requireMembership } from './auth';
import { db, type Database } from './db';
import type { WorkspaceId } from './types';

export type OperationKind = 'contact'|'startup'|'content'|'engagement';
export interface OperationRecord { id:string; workspaceId:WorkspaceId; kind:OperationKind; title:string; organization:string; email:string; notes:string; dueDate:string|null; status:'active'|'waiting'|'completed'|'archived'; category:'general'|'freelance'|'volunteer'; createdAt:string; updatedAt:string; }
export interface SopVersion { id:string; version:number; title:string; content:string; status:'draft'|'approved'; draftedBy:string; approvedBy:string|null; createdAt:string; approvedAt:string|null; }
export interface Sop { id:string; workspaceId:'thv'; title:string; category:'softlanding'|'venture_building'; currentVersion:number; archived:boolean; createdAt:string; updatedAt:string; versions:SopVersion[]; }
const workspace = z.enum(['wasl','thv','personal','independent']);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(`${v}T00:00:00Z`);return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v;},'Invalid calendar date').nullable();
const recordFields = z.object({title:z.string().trim().min(1).max(200),organization:z.string().trim().max(300).default(''),email:z.union([z.email(),z.literal('')]).default(''),notes:z.string().max(12000).default(''),dueDate:date.default(null),status:z.enum(['active','waiting','completed','archived']).default('active'),category:z.enum(['general','freelance','volunteer']).default('general')});
const createRecordSchema=recordFields.extend({workspaceId:workspace,kind:z.enum(['contact','startup','content','engagement'])}).strict();
const createSopSchema=z.object({workspaceId:z.literal('thv'),kind:z.literal('sop'),title:z.string().trim().min(1).max(200),category:z.enum(['softlanding','venture_building']),content:z.string().trim().min(1).max(30000)}).strict();
// Zod4 applies nested creation defaults even under partial(). Omitted PATCH fields
// must remain absent so that merging preserves the existing persisted record.
const updateRecordSchema=z.object({
 title:recordFields.shape.title,
 organization:recordFields.shape.organization.removeDefault(),
 email:recordFields.shape.email.removeDefault(),
 notes:recordFields.shape.notes.removeDefault(),
 dueDate:recordFields.shape.dueDate.removeDefault(),
 status:recordFields.shape.status.removeDefault(),
 category:recordFields.shape.category.removeDefault(),
 kind:z.enum(['contact','startup','content','engagement']),
}).partial().strict().refine(v=>Object.keys(v).length>0,'At least one field is required');
export const sopApprovalSchema=z.object({expectedVersion:z.number().int().positive()}).strict();
const updateSopSchema=z.object({kind:z.literal('sop'),title:z.string().trim().min(1).max(200).optional(),category:z.enum(['softlanding','venture_building']).optional(),content:z.string().trim().min(1).max(30000).optional(),archived:z.boolean().optional()}).strict().refine(v=>Object.keys(v).some(k=>k!=='kind'),'At least one field is required');
const initialized=new WeakSet<object>();
export async function ensureOperationsStorage(database:Database,explicitLocal=false):Promise<void> {
 if(initialized.has(database)) return;
 if(!process.env.DATABASE_URL||explicitLocal) await database.exec(await readFile(path.join(process.cwd(),'supabase/migrations/0005_operations.sql'),'utf8'));
 initialized.add(database);
}
async function storage(database?:Database){const d=database??await db();await ensureOperationsStorage(d);return d;}
const timestamp=(v:unknown)=>v instanceof Date?v.toISOString():String(v);
function record(row:Record<string,unknown>):OperationRecord{return {id:String(row.id),workspaceId:row.workspace_id as WorkspaceId,kind:row.kind as OperationKind,title:String(row.title),organization:String(row.organization),email:String(row.email),notes:String(row.notes),dueDate:row.due_date as string|null,status:row.status as OperationRecord['status'],category:row.category as OperationRecord['category'],createdAt:timestamp(row.created_at),updatedAt:timestamp(row.updated_at)};}
function checkKind(workspaceId:WorkspaceId,kind:OperationKind,category:string):void{
 if(kind==='startup'&&workspaceId!=='thv') throw new ApiError(400,'Startup portfolio records belong to THV');
 if(kind==='engagement'&&workspaceId!=='independent') throw new ApiError(400,'Independent engagements belong to Freelancing & Volunteering');
 if(workspaceId!=='independent'&&category!=='general') throw new ApiError(400,'Freelance and volunteer categories belong to the Independent workspace');
}
async function loadSop(database:Database,id:string):Promise<Sop>{
 const s=(await database.query('SELECT * FROM sops WHERE id=$1',[id])).rows[0];if(!s)throw new ApiError(404,'SOP not found');
 const versions=(await database.query('SELECT * FROM sop_versions WHERE sop_id=$1 AND workspace_id=$2 ORDER BY version DESC',[id,s.workspace_id])).rows.map(v=>({id:String(v.id),version:Number(v.version),title:String(v.title),content:String(v.content),status:v.status as SopVersion['status'],draftedBy:String(v.drafted_by),approvedBy:v.approved_by?String(v.approved_by):null,createdAt:timestamp(v.created_at),approvedAt:v.approved_at?timestamp(v.approved_at):null}));
 return {id:String(s.id),workspaceId:'thv',title:String(s.title),category:s.category as Sop['category'],currentVersion:Number(s.current_version),archived:Boolean(s.archived),createdAt:timestamp(s.created_at),updatedAt:timestamp(s.updated_at),versions};
}
export async function listOperations(userId:string,workspaceId:string,database?:Database):Promise<{sops:Sop[];records:OperationRecord[]}>{
 const w=workspace.parse(workspaceId),d=await storage(database);await requireMembership(userId,w,false,d);
 const records=(await d.query('SELECT * FROM operations_records WHERE workspace_id=$1 ORDER BY updated_at DESC',[w])).rows.map(record);
 const sops=[] as Sop[];if(w==='thv')for(const s of (await d.query('SELECT id FROM sops WHERE workspace_id=$1 ORDER BY updated_at DESC',[w])).rows)sops.push(await loadSop(d,String(s.id)));
 return {sops,records};
}
export async function createOperation(userId:string,input:unknown,database?:Database):Promise<Sop|OperationRecord>{
 const isSop=typeof input==='object'&&input!==null&&'kind'in input&&input.kind==='sop';
 const data=isSop?createSopSchema.parse(input):createRecordSchema.parse(input);const d=await storage(database);
 return d.transaction(async tx=>{
  await requireMembership(userId,data.workspaceId,true,tx);const id=randomUUID();
  if(data.kind==='sop'){
   await tx.query('INSERT INTO sops(id,workspace_id,title,category) VALUES($1,$2,$3,$4)',[id,data.workspaceId,data.title,data.category]);
   await tx.query('INSERT INTO sop_versions(id,sop_id,workspace_id,version,title,content,drafted_by) VALUES($1,$2,$3,1,$4,$5,$6)',[randomUUID(),id,data.workspaceId,data.title,data.content,userId]);
   await audit(tx,userId,data.workspaceId,'sop.created',id);return loadSop(tx,id);
  }
  checkKind(data.workspaceId,data.kind,data.category);
  const row=(await tx.query('INSERT INTO operations_records(id,workspace_id,kind,title,organization,email,notes,due_date,status,category) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[id,data.workspaceId,data.kind,data.title,data.organization,data.email,data.notes,data.dueDate,data.status,data.category])).rows[0];
  await audit(tx,userId,data.workspaceId,`${data.kind}.created`,id);return record(row);
 });
}
export async function updateOperation(userId:string,id:string,input:unknown,database?:Database):Promise<Sop|OperationRecord>{
 z.uuid().parse(id);const d=await storage(database);
 return d.transaction(async tx=>{
  const s=(await tx.query('SELECT * FROM sops WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(s){
   await requireMembership(userId,String(s.workspace_id),true,tx);const data=updateSopSchema.parse(input);const prior=await loadSop(tx,id);const latest=prior.versions[0];
   if(data.title!==undefined||data.content!==undefined||data.category!==undefined){
    const version=Number(s.current_version)+1;
    await tx.query('INSERT INTO sop_versions(id,sop_id,workspace_id,version,title,content,drafted_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,s.workspace_id,version,data.title??s.title,data.content??latest.content,userId]);
    await tx.query('UPDATE sops SET title=$2,category=$3,current_version=$4,updated_at=now() WHERE id=$1',[id,data.title??s.title,data.category??s.category,version]);
   }
   if(data.archived!==undefined)await tx.query('UPDATE sops SET archived=$2,updated_at=now() WHERE id=$1',[id,data.archived]);
   await audit(tx,userId,'thv','sop.versioned',id);return loadSop(tx,id);
  }
  const row=(await tx.query('SELECT * FROM operations_records WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw new ApiError(404,'Record not found');
  await requireMembership(userId,String(row.workspace_id),true,tx);const data=updateRecordSchema.parse(input);const merged={...record(row),...data};
  if(data.kind&&data.kind!==row.kind)throw new ApiError(400,'Record kind cannot be changed');checkKind(merged.workspaceId,merged.kind,merged.category);
  const updated=(await tx.query('UPDATE operations_records SET title=$2,organization=$3,email=$4,notes=$5,due_date=$6,status=$7,category=$8,updated_at=now() WHERE id=$1 RETURNING *',[id,merged.title,merged.organization,merged.email,merged.notes,merged.dueDate,merged.status,merged.category])).rows[0];
  await audit(tx,userId,merged.workspaceId,`${merged.kind}.updated`,id);return record(updated);
 });
}
export async function approveSop(userId:string,id:string,expectedVersion:number,database?:Database):Promise<Sop>{
 z.uuid().parse(id);sopApprovalSchema.parse({expectedVersion});const d=await storage(database);
 return d.transaction(async tx=>{
  const row=(await tx.query('SELECT * FROM sops WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw new ApiError(404,'SOP not found');
  if(await requireMembership(userId,String(row.workspace_id),true,tx)!=='owner')throw new ApiError(403,'Only a workspace owner may approve an SOP');
  if(Number(row.current_version)!==expectedVersion)throw new ApiError(409,'This SOP has changed since you reviewed it. Reload and review the latest version before approval.');
  if(row.archived)throw new ApiError(409,'Restore this SOP before approval');
  const sop=await loadSop(tx,id);if(sop.versions[0].status==='approved')throw new ApiError(409,'This version is already approved');
  await tx.query("UPDATE sop_versions SET status='approved',approved_by=$3,approved_at=now() WHERE sop_id=$1 AND version=$2",[id,row.current_version,userId]);
  await audit(tx,userId,'thv','sop.approved',id);return loadSop(tx,id);
 });
}
export async function deleteOperation(userId:string,id:string,database?:Database):Promise<void>{
 z.uuid().parse(id);const d=await storage(database);
 await d.transaction(async tx=>{
  const row=(await tx.query('SELECT * FROM operations_records WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw new ApiError(404,'Record not found; SOP history can be archived, not deleted');
  await requireMembership(userId,String(row.workspace_id),true,tx);await tx.query('DELETE FROM operations_records WHERE id=$1',[id]);await audit(tx,userId,row.workspace_id as WorkspaceId,`${row.kind}.deleted`,id);
 });
}
