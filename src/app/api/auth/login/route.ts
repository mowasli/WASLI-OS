import { NextResponse } from 'next/server';
import { assertSameOrigin,createSession,login,readJson,respondError,withSession } from '@/lib/auth';
export const runtime='nodejs';
export async function POST(request:Request) {
 try { assertSameOrigin(request); const user=await login(await readJson(request)); return withSession(NextResponse.json({user}),await createSession(user.id),request); }
 catch(error) { return respondError(error); }
}
