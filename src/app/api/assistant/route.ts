import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, assertSameOrigin, readJson, respondError, ApiError } from '@/lib/auth';
import { assistantHistory, answerAssistant } from '@/lib/assistant';
import { workspaceIdSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const schema = z.object({ workspaceId: workspaceIdSchema, message: z.string().trim().min(1).max(6000) }).strict();
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const workspace = new URL(request.url).searchParams.get('workspace');
    if (!workspace) throw new ApiError(400, 'Select one workspace; global private assistant context is not supported');
    return NextResponse.json({ messages: await assistantHistory(user.id, workspace) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return respondError(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser(request);
    const input = schema.parse(await readJson(request));
    return NextResponse.json(await answerAssistant(user.id, input.workspaceId, input.message), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return respondError(error); }
}
