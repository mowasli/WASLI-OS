import { NextResponse } from 'next/server';
import { ApiError, audit, requireMembership, requireUser, respondError } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeGoogleOAuthState, ensureGoogleStorage, finishGoogleOAuth, googleSessionBinding, requireGoogleConfig } from '@/lib/google';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = await requireUser(request), config = requireGoogleConfig();
    const parameters = new URL(request.url).searchParams;
    const database = await db(); await ensureGoogleStorage(database);
    const state = await consumeGoogleOAuthState(database, parameters.get('state') ?? '', googleSessionBinding(request, user.id), config);
    await requireMembership(user.id, state.workspaceId, true);
    if (parameters.has('error')) throw new ApiError(400, 'Google authorization was declined or could not be completed. No connection was confirmed.');
    await finishGoogleOAuth(database, user.id, state.workspaceId, state.service, parameters.get('code') ?? '', state.verifier, config);
    await audit(database, user.id, state.workspaceId, 'integration.google.connected', state.service);
    const destination = new URL('/', config.redirectUri);
    destination.searchParams.set('workspace', state.workspaceId); destination.searchParams.set('google', 'connected');
    return NextResponse.redirect(destination, { status: 303, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) { return respondError(error); }
}
