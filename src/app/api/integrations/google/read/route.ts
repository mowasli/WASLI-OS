import { NextResponse } from 'next/server';
import { requireMembership, requireUser, respondError } from '@/lib/auth';
import { db } from '@/lib/db';
import { workspaceIdSchema } from '@/lib/validation';
import { ensureGoogleStorage, parseGoogleService, readGoogleData, requireGoogleConfig } from '@/lib/google';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = await requireUser(request), parameters = new URL(request.url).searchParams;
    const workspaceId = workspaceIdSchema.parse(parameters.get('workspace')), service = parseGoogleService(parameters.get('service'));
    await requireMembership(user.id, workspaceId);
    const config = requireGoogleConfig(), database = await db(); await ensureGoogleStorage(database);
    const data = await readGoogleData(database, user.id, workspaceId, service, parameters.get('query') ?? '', parameters.get('fileId'), config);
    return NextResponse.json({ workspaceId, service, retrievedAt: new Date().toISOString(), data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return respondError(error); }
}
