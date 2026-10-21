import { NextResponse } from 'next/server';
import { authenticationEnabled, authenticationProvider, currentUser, listWorkspaces, localAuthEnabled, respondError } from '@/lib/auth';
import { db } from '@/lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 try {
  const user=await currentUser(request);
  const setupRequired=localAuthEnabled() && !(await (await db()).query('SELECT id FROM app_users LIMIT 1')).rows.length;
  const authEnabled=authenticationEnabled() && (process.env.NODE_ENV!=='production'||Boolean(process.env.DATABASE_URL));
  return NextResponse.json({user,setupRequired,workspaces:user?await listWorkspaces(user.id):[],localAuthEnabled:localAuthEnabled(),authProvider:authenticationProvider(),authEnabled},{headers:{'Cache-Control':'no-store'}});
 } catch(error) { return respondError(error); }
}
