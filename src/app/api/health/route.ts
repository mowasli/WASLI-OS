import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(){
 try { await (await db()).query('SELECT id FROM workspaces LIMIT 1'); return NextResponse.json({status:'ok',storage:'postgresql'},{headers:{'Cache-Control':'no-store'}}); }
 catch { return NextResponse.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}}); }
}
