import { NextRequest, NextResponse } from 'next/server';
import { runProcessPipeline } from '@/lib/ingestion/pipeline';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkAndAlertHighDamage } from '@/lib/blog/alerts';

export const maxDuration = 60;

/**
 * /api/process
 * Phase 2 of the pipeline: clusters unassigned articles into events,
 * scores them, and runs smokescreen pairing.
 * Triggered by Vercel Cron 5 minutes after /api/ingest.
 *
 * After scoring, checks for high-damage events (a_score > 80) and
 * posts alerts to Bluesky + Mastodon.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runProcessPipeline();

    // After scoring, check for high-damage events and alert
    let alerts: Awaited<ReturnType<typeof checkAndAlertHighDamage>> = [];
    if (result.events_scored > 0) {
      try {
        // Get events scored in the last 30 minutes (this cycle)
        const supabase = createAdminClient();
        const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { data: recentlyScored } = await supabase
          .from('events')
          .select('id')
          .gt('a_score', 0)
          .gte('updated_at', cutoff);

        if (recentlyScored?.length) {
          alerts = await checkAndAlertHighDamage(recentlyScored.map(e => e.id));
        }
      } catch (alertErr) {
        console.error('Alert check error (non-fatal):', alertErr);
      }
    }

    return NextResponse.json({ success: true, ...result, alerts });
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
