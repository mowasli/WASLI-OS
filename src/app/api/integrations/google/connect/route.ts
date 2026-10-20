import { NextResponse } from 'next/server';
import { assertSameOrigin, audit, readJson, requireMembership, requireUser, respondError } from '@/lib/auth';
import { db } from '@/lib/db';
import { workspaceIdSchema } from '@/lib/validation';
import { beginGoogleOAuth, ensureGoogleStorage, googleSessionBinding, parseGoogleService, requireGoogleConfig } from '@/lib/google';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser(request);
    const input = await readJson(request) as Record<string, unknown>;
    const workspaceId = workspaceIdSchema.parse(input?.workspaceId), service = parseGoogleService(input?.service);
    await requireMembership(user.id, workspaceId, true);
    const config = requireGoogleConfig(), database = await db(); await ensureGoogleStorage(database);
    const authorizationUrl = await beginGoogleOAuth(database, googleSessionBinding(request, user.id), workspaceId, service, config);
    await audit(database, user.id, workspaceId, 'integration.google.authorization_started', service);
    return NextResponse.json({ authorizationUrl, workspaceId, service, connected: false }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return respondError(error); }
}
