import { NextResponse } from 'next/server';
import { assertSameOrigin, readJson, requireUser, respondError } from '@/lib/auth';
import { createOperation, listOperations } from '@/lib/operations';
export const runtime='nodejs';
export async function GET(request:Request){try{const user=await requireUser(request);return NextResponse.json(await listOperations(user.id,new URL(request.url).searchParams.get('workspace')??''));}catch(e){return respondError(e);}}
export async function POST(request:Request){try{assertSameOrigin(request);const user=await requireUser(request);return NextResponse.json(await createOperation(user.id,await readJson(request)),{status:201});}catch(e){return respondError(e);}}
