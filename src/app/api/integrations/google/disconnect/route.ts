import { NextResponse } from 'next/server';
import { ApiError, assertSameOrigin, audit, readJson, requireMembership, requireUser, respondError } from '@/lib/auth';
import { db } from '@/lib/db';
import { workspaceIdSchema } from '@/lib/validation';
import { disconnectGoogle, ensureGoogleStorage, parseGoogleService, requireGoogleConfig } from '@/lib/google';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser(request), input = await readJson(request) as Record<string, unknown>;
    const workspaceId = workspaceIdSchema.parse(input?.workspaceId), service = parseGoogleService(input?.service);
    await requireMembership(user.id, workspaceId, true);
    if (input.confirm !== true) throw new ApiError(400, 'Explicit confirmation is required to disconnect this workspace service');
    const revoke = input.revokeAtGoogle === true;
    const config = revoke ? requireGoogleConfig() : undefined, database = await db(); await ensureGoogleStorage(database);
    const result = await disconnectGoogle(database, user.id, workspaceId, service, revoke, config);
    await audit(database, user.id, workspaceId, 'integration.google.disconnected', service);
    return NextResponse.json(result);
  } catch (error) { return respondError(error); }
}
