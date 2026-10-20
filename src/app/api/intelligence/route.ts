import { NextResponse } from 'next/server';
import { ApiError, requireMembership, requireUser, respondError } from '@/lib/auth';
import { intelligenceOverview } from '@/lib/intelligence';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 try {const user=await requireUser(request);const workspace=new URL(request.url).searchParams.get('workspace');if(workspace!=='wasl')throw new ApiError(400,'Intelligence is scoped to WASL only');await requireMembership(user.id,'wasl');return NextResponse.json(await intelligenceOverview());}catch(error){return respondError(error);}
}
