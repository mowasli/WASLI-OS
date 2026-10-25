import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Read-only readiness signal. No credentials, queries, or database details leak. */
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    await (await db()).query('SELECT 1');
    return NextResponse.json({ status: 'ok' }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted database URL]') : 'Unknown database error';
    console.error('WASLI readiness failed:', message);
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
