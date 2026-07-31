import { NextResponse } from 'next/server';
import { checkPipelineFreshness } from '@/lib/monitor/freshness';
import { checkStuckWeeks } from '@/lib/monitor/stuck-week';

// Always evaluate freshness live — never serve a cached "healthy".
export const dynamic = 'force-dynamic';

/**
 * GET /api/health — public, unauthenticated, read-only.
 *
 * Returns the ingestion pipeline's freshness so a "renders fine but no new
 * data" outage (July 2026) is externally detectable. Doubles as the target
 * for the portfolio live-probe sweep (retrospective/scripts/live-probe.mjs).
 *
 * HTTP status is driven by ingest freshness ONLY — 200 when fresh, 503 when
 * stale or the DB is unreachable (fail-closed) — because that is the true
 * "is the site serving fresh data" signal the live-probe/uptime monitors act
 * on. A stuck-live week (missed freeze) is a real but different problem: the
 * site is still up and current data flows, so flipping this to 503 would make
 * the live-probe misreport an up-and-fresh site as down. The stuck-week verdict
 * is surfaced in the body for visibility; the /api/monitor cron owns alerting
 * on it.
 */
export async function GET() {
  const [freshness, stuck] = await Promise.all([
    checkPipelineFreshness(),
    checkStuckWeeks(),
  ]);

  return NextResponse.json(
    { ...freshness, stuck },
    {
      status: freshness.healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
