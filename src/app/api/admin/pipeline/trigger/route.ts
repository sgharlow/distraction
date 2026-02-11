import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/pipeline/trigger — Trigger manual ingest
 * Calls the existing /api/ingest endpoint with CRON_SECRET auth.
 */
export async function POST() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  try {
    const res = await fetch(`${baseUrl}/api/ingest`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const data = await res.json();

    return NextResponse.json({ success: res.ok, ...data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to trigger ingest';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
