import { NextResponse } from 'next/server';
import { currentUser, listWorkspaces, localAuthEnabled, respondError } from '@/lib/auth';
import { db } from '@/lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 try {
  const user=await currentUser(request);
  const setupRequired=localAuthEnabled() && !(await (await db()).query('SELECT id FROM app_users LIMIT 1')).rows.length;
  return NextResponse.json({user,setupRequired,workspaces:user?await listWorkspaces(user.id):[],localAuthEnabled:localAuthEnabled()},{headers:{'Cache-Control':'no-store'}});
 } catch(error) { return respondError(error); }
}
