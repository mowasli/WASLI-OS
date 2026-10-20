import {NextResponse} from 'next/server';
import {requireUser,respondError} from '@/lib/auth';
import {dashboard} from '@/lib/core';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const user=await requireUser(request);return NextResponse.json(await dashboard(user.id),{headers:{'Cache-Control':'no-store'}});}catch(error){return respondError(error);}}
