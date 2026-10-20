import { NextResponse } from 'next/server';
import { assertSameOrigin, readJson, requireUser, respondError } from '@/lib/auth';
import { deleteOperation, updateOperation } from '@/lib/operations';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
export async function PATCH(request:Request,context:Context){try{assertSameOrigin(request);const user=await requireUser(request);return NextResponse.json(await updateOperation(user.id,(await context.params).id,await readJson(request)));}catch(e){return respondError(e);}}
export async function DELETE(request:Request,context:Context){try{assertSameOrigin(request);const user=await requireUser(request);await deleteOperation(user.id,(await context.params).id);return NextResponse.json({ok:true});}catch(e){return respondError(e);}}
