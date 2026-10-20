import { NextResponse } from 'next/server';
import { ApiError, assertSameOrigin, readJson, requireMembership, requireUser, respondError } from '@/lib/auth';
import { scanIntelligence } from '@/lib/intelligence';
export const runtime='nodejs';
export const maxDuration=120;
export async function POST(request:Request) {
 try {assertSameOrigin(request);const user=await requireUser(request);const body=await readJson(request) as {workspaceId?:unknown};if(body?.workspaceId!=='wasl')throw new ApiError(400,'Scans are available only inside WASL');await requireMembership(user.id,'wasl',true);const result=await scanIntelligence('manual');return NextResponse.json(result,{status:result.status==='failed'?502:200});}catch(error){return respondError(error);}
}
