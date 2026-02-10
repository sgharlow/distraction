import { NextRequest, NextResponse } from 'next/server';
import { runIngestPipeline } from '@/lib/ingestion/pipeline';

export const maxDuration = 60; // Vercel Pro allows 60s

/**
 * /api/ingest
 * Triggered by Vercel Cron every 4 hours (also supports manual trigger).
 * Fetches articles, clusters into events, scores new events.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runIngestPipeline();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Ingest pipeline error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
