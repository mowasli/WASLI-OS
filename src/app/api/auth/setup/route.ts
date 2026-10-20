import { NextResponse } from 'next/server';
import { assertSameOrigin,createSession,readJson,respondError,setupOwner,withSession } from '@/lib/auth';
export const runtime='nodejs';
export async function POST(request:Request) {
 try { assertSameOrigin(request); const user=await setupOwner(await readJson(request)); return withSession(NextResponse.json({user},{status:201}),await createSession(user.id),request); }
 catch(error) { return respondError(error); }
}
