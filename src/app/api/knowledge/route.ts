import { NextResponse } from 'next/server';
import { requireUser, respondError, ApiError } from '@/lib/auth';
import { searchKnowledge } from '@/lib/knowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const params = new URL(request.url).searchParams;
    const workspace = params.get('workspace');
    if (!workspace) throw new ApiError(400, 'A workspace is required');
    const query = params.get('query') ?? '';
    if (query.length > 1000) throw new ApiError(400, 'Search query is too long');
    let documents = await searchKnowledge(user.id, workspace, query);
    const document = params.get('document');
    if (document) documents = documents.filter(entry => entry.documentId === document);
    return NextResponse.json({ documents, mode: 'lexical-search', scope: workspace, liveResearch: false }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return respondError(error); }
}
