import { NextResponse } from 'next/server';
import {listWorkspaces,requireUser,respondError} from '@/lib/auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) { try {const user=await requireUser(request);return NextResponse.json(await listWorkspaces(user.id),{headers:{'Cache-Control':'no-store'}});}catch(error){return respondError(error);} }
