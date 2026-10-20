/** External source text is evidence only. This module never executes instructions in it. */
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { EnvHttpProxyAgent, fetch as fetchViaProxy } from 'undici';
import { db, type Database } from './db';
import { z } from 'zod';
import { ApiError, audit, requireMembership } from './auth';
import { createProject, getProject } from './core';
import { idSchema } from './validation';
import type { Project } from './types';

export const SCORE_WEIGHTS = { capability:25, strategic:20, commercial:20, delivery:15, urgency:10, ecosystem:10 } as const;
export type ScoreDimensions = Record<keyof typeof SCORE_WEIGHTS, number>;
export type Eligibility = 'unknown'|'eligible'|'ineligible';
export interface IntelligenceComment {id:string;userId:string;author:string;body:string;createdAt:string}
export interface CuratedIntelligenceRecord extends IntelligenceRecord {saved:boolean;tags:string[];notes:string;comments:IntelligenceComment[];projectId:string|null}
export interface IntelligenceRecord {
 id:string; workspaceId:'wasl'; externalId:string; title:string; organization:string; country:string;
 type:'procurement_notice'; description:string; sourceUrl:string; publishedAt:string|null; deadline:string|null;
 lastVerifiedAt:string; contentHash:string; status:'new'|'updated'|'expired'|'unverified'|'archived';
 eligibility:Eligibility; fitScore:number; scoreMethod:'rules-based'; recommendedAction:'Apply'|'Explore'|'Monitor'|'Pass';
 verificationNote:string; provenance:Record<string,unknown>;
}
export interface SourceDefinition {id:string;name:string;endpoint:string}
export const SOURCES:readonly SourceDefinition[] = [
 {id:'worldbank-yemen',name:'World Bank procurement — Yemen',endpoint:'https://search.worldbank.org/api/v2/procnotices?format=json&rows=50&os=0&qterm=Yemen'},
 {id:'worldbank-entrepreneurship',name:'World Bank procurement — entrepreneurship (MENA filter)',endpoint:'https://search.worldbank.org/api/v2/procnotices?format=json&rows=50&os=0&qterm=entrepreneurship'},
];
const SOURCE_HOSTS = new Set(['search.worldbank.org','projects.worldbank.org','www.worldbank.org']);
const MAX_BYTES=2_000_000;
const initialized=new WeakSet<object>();

export function isAllowedSourceUrl(value:string):boolean {
 try {const u=new URL(value);return u.protocol==='https:'&&SOURCE_HOSTS.has(u.hostname)&&!u.username&&!u.password&&(!u.port||u.port==='443');}catch{return false;}
}
export function scoreOpportunity(values:ScoreDimensions, weights:ScoreDimensions={...SCORE_WEIGHTS}):number {
 let total=0,sum=0;
 for(const key of Object.keys(SCORE_WEIGHTS) as (keyof ScoreDimensions)[]) {
  const value=values[key],weight=weights[key];
  if(!Number.isFinite(value)||value<0||value>100||!Number.isFinite(weight)||weight<0)throw new Error('Score values must be 0–100 and weights nonnegative');
  total+=value*weight;sum+=weight;
 }
 if(Math.abs(sum-100)>0.001)throw new Error('Opportunity weights must sum to 100');
 return Math.round(total/100);
}
export function recommendAction(eligibility:Eligibility,score:number,expired:boolean):IntelligenceRecord['recommendedAction'] {
 if(expired||eligibility==='ineligible')return 'Pass';
 if(eligibility==='eligible'&&score>=70)return 'Apply';
 return score>=50?'Explore':'Monitor';
}
export async function ensureIntelligenceSchema(database:Database):Promise<void> {
 if(initialized.has(database))return;
 // Never modify a production database as a side effect of a web request.
 if(process.env.DATABASE_URL) {
  await database.query('SELECT id FROM intelligence_records LIMIT 0');
 } else {
  const sql=await readFile(path.join(process.cwd(),'supabase/migrations/0002_intelligence.sql'),'utf8');
  await database.exec(sql);
 }
 if(!process.env.DATABASE_URL)for(const source of SOURCES)await database.query('INSERT INTO intelligence_sources(id,workspace_id,name,endpoint) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',[source.id,'wasl',source.name,source.endpoint]);
 initialized.add(database);
}
function cleanText(value:unknown,max=10000):string {
 return typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max):typeof value==='number'?String(value):'';
}
function first(row:Record<string,unknown>,keys:string[],max=10000):string {for(const key of keys){const value=cleanText(row[key],max);if(value)return value;}return '';}
function validDate(value:string):string|null {
 if(!value)return null;
 const monthDate=value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
 if(monthDate){const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(monthDate[2].toLowerCase())+1;if(month>0)value=`${monthDate[3]}-${String(month).padStart(2,'0')}-${monthDate[1].padStart(2,'0')}`;}
 const match=value.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s]|$)/);
 if(!match)return null;
 const date=match[1];try {return new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date?date:null;}catch{return null;}
}
const MENA=/yemen|egypt|jordan|morocco|tunisia|lebanon|iraq|algeria|libya|saudi|emirates|oman|palestin|djibouti|bahrain|kuwait|qatar|syria|sudan|mena|middle east|north africa/i;
function ruleScore(title:string,description:string,country:string,deadline:string|null,now:Date):ScoreDimensions {
 const text=title+' '+description;
 const capability=/entrepreneur|startup|incubat|accelerat|venture|enterprise|msme|capacity.build|innovation|business.develop|ecosystem/i.test(text)?85:15;
 const strategic=/yemen|fragile|women|youth|underserved/i.test(country+' '+text)?85:45;
 const days=deadline?Math.ceil((new Date(deadline+'T23:59:59Z').getTime()-now.getTime())/86400000):null;
 return {capability,strategic,commercial:40,delivery:20,urgency:days===null?20:days<0?0:days<=14?90:50,ecosystem:/partner|consortium|collaborat|ecosystem|mentor|training/i.test(text)?80:25};
}
export function parseWorldBankResponse(payload:unknown,source:SourceDefinition,now=new Date()):IntelligenceRecord[] {
 if(!payload||typeof payload!=='object')throw new Error('Official API returned an invalid JSON object');
 const container=(payload as Record<string,unknown>).procnotices;
 if(!container||typeof container!=='object')throw new Error('Official API response schema is not recognized (missing procnotices); no records were inferred');
 const output:IntelligenceRecord[]=[];let candidateRows=0;let recognizedRows=0;
 for(const item of Object.values(container)) {
  if(!item||typeof item!=='object'||Array.isArray(item))continue;
  const row=item as Record<string,unknown>;candidateRows++;
  const externalId=first(row,['id','notice_id','noticeid'],120);
  const title=first(row,['notice_title','noticetitle','title','bid_description','project_name','projectname'],500);
  const country=first(row,['project_ctry_name','countryname','country_name','country'],200);
  if(!externalId||!title||!country)continue;recognizedRows++;if(!MENA.test(country))continue;
  const noticeType=first(row,['notice_type','noticetype'],200);
  const sourceStatus=first(row,['notice_status','status'],100);
  if(/contract.award|cancelled|canceled|closed/i.test(noticeType+' '+sourceStatus))continue;
  const description=first(row,['notice_text','noticetext','description','notice_description'],20000);
  const candidate=first(row,['url','notice_url','noticeurl','link'],2000);
  // A missing per-notice URL cites the exact official API response, never an invented notice path.
  const sourceUrl=isAllowedSourceUrl(candidate)?candidate:source.endpoint;
  const publishedAt=validDate(first(row,['noticedate','notice_date','publication_date','published_date'],100));
  const deadline=validDate(first(row,['submission_deadline_date','bid_submission_deadline_date','submission_deadline','deadline','bid_deadline'],100));
  const organization=first(row,['contact_organization','borrower','implementingagency','organization','buyer'],300);
  const dimensions=ruleScore(title,description,country,deadline,now);const fitScore=scoreOpportunity(dimensions);
  const expired=deadline!==null&&deadline<now.toISOString().slice(0,10);
  const facts={externalId,title,organization,country,description,sourceUrl,publishedAt,deadline};
  output.push({id:randomUUID(),workspaceId:'wasl',...facts,type:'procurement_notice',lastVerifiedAt:now.toISOString(),contentHash:createHash('sha256').update(JSON.stringify(facts)).digest('hex'),status:expired?'expired':'unverified',eligibility:'unknown',fitScore,scoreMethod:'rules-based',recommendedAction:recommendAction('unknown',fitScore,expired),verificationNote:'Retrieved from the official World Bank API. Eligibility, buyer details, dates and delivery requirements need human verification before applying. Score is a transparent keyword heuristic, not an AI evaluation.',provenance:{sourceId:source.id,retrievalUrl:source.endpoint,retrievedAt:now.toISOString(),dimensions,weights:SCORE_WEIGHTS,sourceTextTrust:'untrusted_evidence_only',noticeUrlProvided:isAllowedSourceUrl(candidate),noticeType,sourceStatus}});
 }
 if(candidateRows>0&&recognizedRows===0)throw new Error('Official API row schema is not recognized; no records were inferred');
 return output;
}
export async function fetchOfficialJson(endpoint:string,fetcher:typeof fetch=fetch):Promise<unknown> {
 if(!isAllowedSourceUrl(endpoint))throw new Error('Source URL is outside the approved HTTPS allowlist');
 // Route external traffic through the provided proxy. This honors the egress policy;
 // it never falls back to direct networking after a denial.
 const dispatcher=fetcher===fetch?new EnvHttpProxyAgent():undefined;
 try {
  const options={redirect:'error' as const,signal:AbortSignal.timeout(20000),headers:{Accept:'application/json','User-Agent':'WASLI-OS/0.1 (public procurement research)'}};
  const response=dispatcher?await fetchViaProxy(endpoint,{...options,dispatcher}):await fetcher(endpoint,options);
  if(!response.ok)throw new Error(`Official source returned HTTP ${response.status}`);
  if(Number(response.headers.get('content-length')||0)>MAX_BYTES)throw new Error('Official source exceeded response size limit');
  if(!response.body)throw new Error('Official source returned an empty response');
  const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
  try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();throw new Error('Official source exceeded response size limit');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new Error('Official source did not return valid JSON');}
 }finally{await dispatcher?.close();}
}

export async function storeRecords(database:Database,records:IntelligenceRecord[]):Promise<{discovered:number;updated:number}> {
 let discovered=0,updated=0;
 for(const record of records) {
  const existing=await database.query<{content_hash:string;status:string}>('SELECT content_hash,status FROM intelligence_records WHERE workspace_id=$1 AND external_id=$2',['wasl',record.externalId]);
  const previous=existing.rows[0];
  if(previous?.status==='archived')continue;
  const changed=!!previous&&previous.content_hash!==record.contentHash;
  const status=record.status==='expired'?'expired':changed?'updated':previous?.status??record.status;
  // A user can archive after the pre-read while a scan is in flight. Preserve
  // that decision against the actual conflicting row, not its stale snapshot.
  await database.query(`INSERT INTO intelligence_records(id,workspace_id,external_id,title,organization,country,type,description,source_url,published_at,deadline,last_verified_at,content_hash,status,eligibility,fit_score,score_method,recommended_action,verification_note,provenance)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb)
   ON CONFLICT(workspace_id,external_id) DO UPDATE SET title=excluded.title,organization=excluded.organization,country=excluded.country,description=excluded.description,source_url=excluded.source_url,published_at=excluded.published_at,deadline=excluded.deadline,last_verified_at=excluded.last_verified_at,content_hash=excluded.content_hash,status=CASE WHEN intelligence_records.status='archived' THEN 'archived' ELSE excluded.status END,fit_score=excluded.fit_score,recommended_action=excluded.recommended_action,verification_note=excluded.verification_note,provenance=excluded.provenance,updated_at=now()`,
   [record.id,'wasl',record.externalId,record.title,record.organization,record.country,record.type,record.description,record.sourceUrl,record.publishedAt,record.deadline,record.lastVerifiedAt,record.contentHash,status,record.eligibility,record.fitScore,record.scoreMethod,record.recommendedAction,record.verificationNote,JSON.stringify(record.provenance)]);
  if(!previous)discovered++;else if(changed)updated++;
 }
 return {discovered,updated};
}
function sourceErrorMessage(error:unknown):string {
 if(!(error instanceof Error))return 'Source retrieval failed';
 const cause=(error as Error & {cause?:unknown}).cause;
 const detail=cause instanceof Error?`: ${cause.message}`:'';
 return (error.message+detail).replace(/https?:\/\/[^\s]+/g,'[source URL]').slice(0,500);
}
interface SourceResult {sourceId:string;status:'succeeded'|'failed';fetched:number;attempts:number;error?:string}
export async function scanIntelligence(trigger:'manual'|'scheduled'|'cli'='manual',database?:Database,fetcher:typeof fetch=fetch) {
 const connection=database??await db();await ensureIntelligenceSchema(connection);
 await connection.query("UPDATE intelligence_jobs SET status='failed',finished_at=now(),error='Job lease expired after 30 minutes' WHERE status='running' AND started_at<now()-interval '30 minutes'");
 const id=randomUUID();
 try {await connection.query('INSERT INTO intelligence_jobs(id,workspace_id,trigger,status) VALUES($1,$2,$3,$4)',[id,'wasl',trigger,'running']);}
 catch(error) {if((error as {code?:string}).code==='23505')throw new Error('An intelligence scan is already running');throw error;}
 const results:SourceResult[]=[];let discovered=0,updated=0;
 try {
  for(const source of SOURCES) {
   const enabled=await connection.query<{enabled:boolean}>('SELECT enabled FROM intelligence_sources WHERE id=$1 AND workspace_id=$2',[source.id,'wasl']);if(!enabled.rows[0]?.enabled)continue;
   await connection.query('UPDATE intelligence_sources SET last_attempt_at=now() WHERE id=$1',[source.id]);
   let error='';let success=false;let attempts=0;
   for(let attempt=1;attempt<=2;attempt++) {
    attempts=attempt;
    try {const payload=await fetchOfficialJson(source.endpoint,fetcher);const records=parseWorldBankResponse(payload,source);const saved=await connection.transaction(tx=>storeRecords(tx,records));discovered+=saved.discovered;updated+=saved.updated;results.push({sourceId:source.id,status:'succeeded',fetched:records.length,attempts:attempt});await connection.query('UPDATE intelligence_sources SET last_success_at=now(),last_error=NULL WHERE id=$1',[source.id]);success=true;break;}
    catch(caught) {error=sourceErrorMessage(caught);if(attempt===1&&!/HTTP 4\d\d|\(403\)|schema|allowlist|size limit|invalid JSON/.test(error))continue;break;}
   }
   if(!success){results.push({sourceId:source.id,status:'failed',fetched:0,attempts,error});await connection.query('UPDATE intelligence_sources SET last_error=$1 WHERE id=$2',[error,source.id]);}
  }
  const successes=results.filter(x=>x.status==='succeeded').length;
  const status=successes===results.length&&results.length>0?'succeeded':successes>0?'partial':'failed';
  await connection.query('UPDATE intelligence_jobs SET status=$1,finished_at=now(),discovered=$2,updated=$3,source_results=$4::jsonb,error=$5 WHERE id=$6',[status,discovered,updated,JSON.stringify(results),status==='failed'?'No configured sources were retrieved successfully':null,id]);
  return {id,status,discovered,updated,sourceResults:results};
 }catch(error){await connection.query("UPDATE intelligence_jobs SET status='failed',finished_at=now(),error=$1 WHERE id=$2",[error instanceof Error?error.message.slice(0,500):'Scan failed',id]);throw error;}
}
const RECORD_FIELDS = `i.id,i.workspace_id AS "workspaceId",i.external_id AS "externalId",i.title,i.organization,i.country,i.type,i.description,i.source_url AS "sourceUrl",i.published_at AS "publishedAt",i.deadline,i.last_verified_at AS "lastVerifiedAt",i.content_hash AS "contentHash",i.status,i.eligibility,i.fit_score AS "fitScore",i.score_method AS "scoreMethod",i.recommended_action AS "recommendedAction",i.verification_note AS "verificationNote",i.provenance,i.saved,i.tags,i.notes,i.project_id AS "projectId",COALESCE((SELECT jsonb_agg(c ORDER BY c."createdAt") FROM (SELECT id,user_id AS "userId",author,body,created_at::text AS "createdAt" FROM intelligence_comments WHERE record_id=i.id AND workspace_id=i.workspace_id ORDER BY created_at DESC LIMIT 20) c),'[]'::jsonb) AS comments`;
export async function intelligenceOverview(database?:Database) {
 const connection=database??await db();await ensureIntelligenceSchema(connection);
 const records=await connection.query<CuratedIntelligenceRecord>(`SELECT ${RECORD_FIELDS} FROM intelligence_records i WHERE i.workspace_id=$1 ORDER BY i.last_verified_at DESC,i.id ASC LIMIT 250`,['wasl']);
 const sources=await connection.query('SELECT id,name,endpoint,enabled,last_attempt_at AS "lastAttemptAt",last_success_at AS "lastSuccessAt",last_error AS "lastError" FROM intelligence_sources WHERE workspace_id=$1 ORDER BY id',['wasl']);
 const jobs=await connection.query('SELECT id,trigger,status,started_at AS "startedAt",finished_at AS "finishedAt",discovered,updated,source_results AS "sourceResults",error FROM intelligence_jobs WHERE workspace_id=$1 ORDER BY started_at DESC LIMIT 20',['wasl']);
 return {records:records.rows,sources:sources.rows,jobs:jobs.rows,schedule:{status:'not_deployed',timezone:'Africa/Cairo',localTime:'08:00'},scoreWeights:SCORE_WEIGHTS};
}

export function validCronAuthorization(header:string|null,secret:string|undefined):boolean {
 if(!secret||secret.length<32||!header?.startsWith('Bearer '))return false;
 const provided=Buffer.from(header.slice(7));const expected=Buffer.from(secret);
 return provided.length===expected.length&&timingSafeEqual(provided,expected);
}

const intelligencePatchSchema=z.object({
 saved:z.boolean().optional(),tags:z.array(z.string().trim().min(1).max(50)).max(20).optional(),
 notes:z.string().max(10000).optional(),status:z.enum(['archived','unverified']).optional(),
 comment:z.string().trim().min(1).max(2000).optional(),
}).strict().refine(value=>Object.keys(value).length>0,'No changes supplied');

export async function getIntelligenceRecord(userId:string,id:string,database?:Database,write=false,lock=false):Promise<CuratedIntelligenceRecord> {
 idSchema.parse(id);const connection=database??await db();if(!database)await ensureIntelligenceSchema(connection);
 await requireMembership(userId,'wasl',write,connection);
 const result=await connection.query<CuratedIntelligenceRecord>(`SELECT ${RECORD_FIELDS} FROM intelligence_records i WHERE i.id=$1 AND i.workspace_id=$2${lock?' FOR UPDATE OF i':''}`,[id,'wasl']);
 if(!result.rows[0])throw new ApiError(404,'WASL intelligence record not found');return result.rows[0];
}
export async function updateIntelligenceRecord(userId:string,id:string,input:unknown,database?:Database):Promise<CuratedIntelligenceRecord> {
 const patch=intelligencePatchSchema.parse(input);const connection=database??await db();await ensureIntelligenceSchema(connection);
 await requireMembership(userId,'wasl',true,connection);
 return connection.transaction(async tx=>{
  const current=await getIntelligenceRecord(userId,id,tx,true,true);
  const status=patch.status==='unverified'?(current.deadline&&current.deadline<new Date().toISOString().slice(0,10)?'expired':'unverified'):patch.status??current.status;
  await tx.query('UPDATE intelligence_records SET saved=$1,tags=$2::jsonb,notes=$3,status=$4,updated_at=now() WHERE id=$5 AND workspace_id=$6',[patch.saved??current.saved,JSON.stringify(patch.tags??current.tags),patch.notes??current.notes,status,id,'wasl']);
  if(patch.comment){
   const author=(await tx.query<{name:string}>('SELECT name FROM app_users WHERE id=$1',[userId])).rows[0]?.name;
   if(!author)throw new ApiError(401,'Account is unavailable');
   const commentId=randomUUID();await tx.query('INSERT INTO intelligence_comments(id,record_id,workspace_id,user_id,author,body) VALUES($1,$2,$3,$4,$5,$6)',[commentId,id,'wasl',userId,author,patch.comment]);
   await audit(tx,userId,'wasl','intelligence.comment_added',commentId);
  }
  await audit(tx,userId,'wasl','intelligence.updated',id);
  return getIntelligenceRecord(userId,id,tx);
 });
}
export async function convertIntelligenceToProject(userId:string,id:string,database?:Database):Promise<{project:Project;created:boolean}> {
 const connection=database??await db();await ensureIntelligenceSchema(connection);await requireMembership(userId,'wasl',true,connection);
 return connection.transaction(async tx=>{
  const record=await getIntelligenceRecord(userId,id,tx,true,true);
  if(record.projectId)return {project:await getProject(userId,record.projectId,tx),created:false};
  const project=await createProject(userId,{
   workspaceId:'wasl',name:('Research: '+record.title).slice(0,200),status:'active',dueDate:null,category:'general',milestones:[],
   description:`Research review only. This project does not represent an application, eligibility determination, external commitment or outreach.\n\nSource: ${record.sourceUrl}\nSource record: ${record.externalId}\nSource deadline: ${record.deadline??'Not supplied'}\nRecord state: ${record.status}; eligibility: ${record.eligibility}.\n\nVerify currentness, mandatory eligibility, commercial fit and delivery capability before deciding on a separate application. No submission has been made.`,
  },tx);
  await tx.query('UPDATE intelligence_records SET project_id=$1,updated_at=now() WHERE id=$2 AND workspace_id=$3',[project.id,id,'wasl']);
  await audit(tx,userId,'wasl','intelligence.research_project_created',id);
  return {project,created:true};
 });
}
