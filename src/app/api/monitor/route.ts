import { NextRequest, NextResponse } from 'next/server';
import { checkPipelineFreshness } from '@/lib/monitor/freshness';
import { checkStuckWeeks } from '@/lib/monitor/stuck-week';
import { checkMissingBlogs } from '@/lib/monitor/missing-blog';
import { sendHealthAlert } from '@/lib/monitor/alert';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/monitor — the dead-man's-switch cron (CRON_SECRET-authed).
 *
 * Runs daily and checks the three silent failure modes July 2026 exposed:
 *   1. Ingest freshness — no article-bearing ingest inside the window (data
 *      not flowing: Supabase paused, feeds blocked, or the ingest cron dead).
 *   2. Stuck-live weeks — a week left status='live' past its scheduled freeze
 *      (a missed Sunday freeze cron; week 2026-07-05 sat unfrozen 3 weeks).
 *   3. Missing blogs — a frozen week whose cascade blog step never wrote. The
 *      freeze logs 'completed' BEFORE the cascade and swallows its errors, so
 *      this produced no signal at all for 17 weeks (67-83).
 *
 * If ANY is unhealthy it emails the operator via Resend (Supabase-independent,
 * so it fires even when Supabase itself is the outage). Daily cadence
 * self-throttles to at most one alert per day while down — no dedup table needed.
 *
 * This is the gap that let the July 2026 outage sit unnoticed for 3 weeks.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [freshness, stuck, blogs] = await Promise.all([
    checkPipelineFreshness(),
    checkStuckWeeks(),
    checkMissingBlogs(),
  ]);

  let alert = { sent: false } as Awaited<ReturnType<typeof sendHealthAlert>>;
  if (!freshness.healthy || !stuck.healthy || !blogs.healthy) {
    alert = await sendHealthAlert({ freshness, stuck, blogs });
    console.error(
      '[monitor] Pipeline unhealthy:',
      'freshness=', freshness.detail,
      '| stuck=', stuck.detail,
      '| blogs=', blogs.detail,
      '| alert:', JSON.stringify(alert),
    );
  }

  // 200 to the cron regardless (the cron ran successfully); the payload carries
  // the health verdict and whether an alert was dispatched.
  return NextResponse.json({ ok: true, freshness, stuck, blogs, alert });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
