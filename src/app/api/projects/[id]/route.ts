import {NextResponse} from 'next/server';
import {assertSameOrigin,readJson,requireUser,respondError} from '@/lib/auth';
import {deleteProject,getProject,updateProject} from '@/lib/core';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context){try{const user=await requireUser(request);return NextResponse.json(await getProject(user.id,(await context.params).id),{headers:{'Cache-Control':'no-store'}});}catch(error){return respondError(error);}}
export async function PATCH(request:Request,context:Context){try{assertSameOrigin(request);const user=await requireUser(request);return NextResponse.json(await updateProject(user.id,(await context.params).id,await readJson(request)));}catch(error){return respondError(error);}}
export async function DELETE(request:Request,context:Context){try{assertSameOrigin(request);const user=await requireUser(request);await deleteProject(user.id,(await context.params).id);return NextResponse.json({ok:true});}catch(error){return respondError(error);}}
