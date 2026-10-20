import { NextResponse } from 'next/server';
import { scanIntelligence, validCronAuthorization } from '@/lib/intelligence';
export const runtime='nodejs';
export const maxDuration=120;
export async function POST(request:Request) {
 if(!process.env.WASLI_CRON_SECRET||process.env.WASLI_CRON_SECRET.length<32)return NextResponse.json({error:'Scheduled jobs are not configured'},{status:503});
 if(!validCronAuthorization(request.headers.get('authorization'),process.env.WASLI_CRON_SECRET))return NextResponse.json({error:'Invalid job authorization'},{status:401});
 try {const result=await scanIntelligence('scheduled');return NextResponse.json(result,{status:result.status==='failed'?502:200});}catch{return NextResponse.json({error:'Scheduled scan failed; inspect job logs'},{status:500});}
}
