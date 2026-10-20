import {NextResponse} from 'next/server';
import {z} from 'zod';
import {assertSameOrigin,readJson,requireUser,respondError} from '@/lib/auth';
import {changeMember} from '@/lib/core';
import {workspaceIdSchema} from '@/lib/validation';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
export async function PATCH(request:Request,context:Context){try{assertSameOrigin(request);const user=await requireUser(request);const data=z.object({workspaceId:workspaceIdSchema,role:z.enum(['owner','editor','viewer'])}).strict().parse(await readJson(request));await changeMember(user.id,(await context.params).id,data.workspaceId,data.role);return NextResponse.json({ok:true});}catch(error){return respondError(error);}}
export async function DELETE(request:Request,context:Context){try{assertSameOrigin(request);const user=await requireUser(request);await changeMember(user.id,(await context.params).id,new URL(request.url).searchParams.get('workspace')??'',null);return NextResponse.json({ok:true});}catch(error){return respondError(error);}}
