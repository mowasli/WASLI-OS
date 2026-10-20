import {NextResponse} from 'next/server';
import {assertSameOrigin,readJson,requireUser,respondError} from '@/lib/auth';
import {createTask,listTasks} from '@/lib/core';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {try{const user=await requireUser(request);return NextResponse.json(await listTasks(user.id,new URL(request.url).searchParams.get('workspace')??''),{headers:{'Cache-Control':'no-store'}});}catch(error){return respondError(error);}}
export async function POST(request:Request) {try{assertSameOrigin(request);const user=await requireUser(request);return NextResponse.json(await createTask(user.id,await readJson(request)),{status:201});}catch(error){return respondError(error);}}
