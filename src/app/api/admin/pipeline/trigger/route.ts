import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/pipeline/trigger — Trigger manual pipeline run
 * Accepts ?type=ingest (default) or ?type=process
 */
export async function POST(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const type = request.nextUrl.searchParams.get('type') || 'ingest';
  const endpoint = type === 'process' ? '/api/process' : '/api/ingest';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const data = await res.json();

    return NextResponse.json({ success: res.ok, ...data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to trigger pipeline';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
