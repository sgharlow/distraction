import { NextRequest, NextResponse } from 'next/server';
import { runProcessPipeline } from '@/lib/ingestion/pipeline';

export const maxDuration = 60;

/**
 * /api/process
 * Phase 2 of the pipeline: clusters unassigned articles into events,
 * scores them, and runs smokescreen pairing.
 * Triggered by Vercel Cron 5 minutes after /api/ingest.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runProcessPipeline();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Process pipeline error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
