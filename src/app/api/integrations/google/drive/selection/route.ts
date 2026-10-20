import { NextResponse } from 'next/server';
import { ApiError, assertSameOrigin, audit, readJson, requireMembership, requireUser, respondError } from '@/lib/auth';
import { db } from '@/lib/db';
import { workspaceIdSchema } from '@/lib/validation';
import { ensureGoogleStorage, selectGoogleDriveFiles } from '@/lib/google';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser(request), input = await readJson(request) as Record<string, unknown>;
    const workspaceId = workspaceIdSchema.parse(input?.workspaceId);
    await requireMembership(user.id, workspaceId, true);
    if (input.confirm !== true) throw new ApiError(400, 'Explicit confirmation is required to authorize the selected Drive documents');
    const database = await db(); await ensureGoogleStorage(database);
    const selectedFiles = await selectGoogleDriveFiles(database, user.id, workspaceId, input.fileIds);
    await audit(database, user.id, workspaceId, 'integration.google.drive_selection_changed', 'drive');
    return NextResponse.json({ workspaceId, selectedFiles, indexed: false, note: 'Selection authorizes metadata retrieval only. Google must separately grant this app access, for example through Google Picker.' });
  } catch (error) { return respondError(error); }
}
