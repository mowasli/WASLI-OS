import { NextResponse } from 'next/server';
import { assertSameOrigin,logout,respondError,SESSION_COOKIE } from '@/lib/auth';
export const runtime='nodejs';
export async function POST(request:Request) {
 try { assertSameOrigin(request); await logout(request); const response=NextResponse.json({ok:true}); response.cookies.set(SESSION_COOKIE,'',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'||new URL(request.url).protocol==='https:',path:'/',maxAge:0}); return response; }
 catch(error) { return respondError(error); }
}
