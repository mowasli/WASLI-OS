import { NextResponse } from 'next/server';
import { assertSameOrigin, readJson, requireUser, respondError } from '@/lib/auth';
import { approveSop, sopApprovalSchema } from '@/lib/operations';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{assertSameOrigin(request);const user=await requireUser(request);const input=sopApprovalSchema.parse(await readJson(request));return NextResponse.json(await approveSop(user.id,(await context.params).id,input.expectedVersion));}catch(e){return respondError(e);}}
