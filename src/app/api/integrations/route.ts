import { NextResponse } from 'next/server';
import { requireUser, requireMembership, respondError } from '@/lib/auth';
import { db } from '@/lib/db';
import { workspaceIdSchema } from '@/lib/validation';
import { ensureGoogleStorage, googleConfigurationStatus, googleConnectionStatuses } from '@/lib/google';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const workspaceId = workspaceIdSchema.parse(new URL(request.url).searchParams.get('workspace'));
    await requireMembership(user.id, workspaceId);
    const database = await db(); await ensureGoogleStorage(database);
    return NextResponse.json({ workspaceId, google: googleConfigurationStatus(), services: await googleConnectionStatuses(database, user.id, workspaceId), indexing: 'Explicit document selection required; no automatic account indexing', externalWrites: 'Not implemented' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return respondError(error); }
}
