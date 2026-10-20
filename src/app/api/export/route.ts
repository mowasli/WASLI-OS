import {NextResponse} from 'next/server';
import {requireMembership,requireUser,respondError} from '@/lib/auth';
import {listProjects,listTasks} from '@/lib/core';
import {db} from '@/lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const user=await requireUser(request);const workspace=new URL(request.url).searchParams.get('workspace')??'';await requireMembership(user.id,workspace);const [tasks,projects,audit]=await Promise.all([listTasks(user.id,workspace),listProjects(user.id,workspace),(await db()).query('SELECT id,action,entity_id AS "entityId",created_at::text AS "createdAt" FROM audit_logs WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 1000',[workspace])]);return NextResponse.json({formatVersion:1,workspace,exportedAt:new Date().toISOString(),tasks,projects,audit:audit.rows},{headers:{'Cache-Control':'no-store','Content-Disposition':`attachment; filename="wasli-${workspace}-export.json"`}});}catch(error){return respondError(error);}}
