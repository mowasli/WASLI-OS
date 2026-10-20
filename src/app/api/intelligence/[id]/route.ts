import { NextResponse } from 'next/server';
import { assertSameOrigin, readJson, requireUser, respondError } from '@/lib/auth';
import { getIntelligenceRecord, updateIntelligenceRecord } from '@/lib/intelligence';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
 try {const user=await requireUser(request);return NextResponse.json(await getIntelligenceRecord(user.id,(await context.params).id));}catch(error){return respondError(error);}
}
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}) {
 try {assertSameOrigin(request);const user=await requireUser(request);return NextResponse.json(await updateIntelligenceRecord(user.id,(await context.params).id,await readJson(request)));}catch(error){return respondError(error);}
}
