import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, readJson, requireUser, respondError } from '@/lib/auth';
import { convertIntelligenceToProject } from '@/lib/intelligence';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
 try {assertSameOrigin(request);const user=await requireUser(request);z.object({}).strict().parse(await readJson(request));const result=await convertIntelligenceToProject(user.id,(await context.params).id);return NextResponse.json(result,{status:result.created?201:200});}catch(error){return respondError(error);}
}
