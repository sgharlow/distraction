// ═══════════════════════════════════════════════════════════════
// Pipeline freshness check — the dead-man's-switch core.
//
// The July 2026 outage went unnoticed for 3 weeks because Supabase was
// PAUSED while Vercel crons kept firing: every render still returned 200,
// so nothing signalled that no new data was landing. This module answers
// one question — "when did a successful ingest last store articles?" —
// and FAILS CLOSED: if the DB itself can't be read (the paused-Supabase
// case), that is an alert condition, never a silent pass.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Hours since the last article-bearing ingest before we call the pipeline stale.
 *
 * 🔴 THIS VALUE IS COUPLED TO THE CRON CADENCE IN `vercel.json`. It was 10
 * ("≈ 2.5 missed 4h cycles") while `/api/ingest` ran `0 * /4 * * *`. The
 * monetize-or-civic gate (ruled 2026-08-24) cut ingestion to DAILY at 04:00
 * UTC, which makes a healthy pipeline's age routinely exceed 10h — the old
 * default would have put `/api/health` into a permanent 503 and mailed a
 * dead-man's-switch alert every single day, which is how a real monitor gets
 * muted and then ignored.
 *
 * 30h = one missed daily cycle (24h) + 6h grace. Tighter than the old 2.5×
 * ratio on purpose: under daily cadence a single miss costs a whole day of
 * data, so it deserves to alert after one, not after two and a half.
 *
 * ⚠️ If the cadence changes again, change this in the same commit.
 */
export const DEFAULT_STALENESS_THRESHOLD_HOURS = 30;

export type FreshnessState = 'fresh' | 'stale' | 'error';

export interface FreshnessStatus {
  /** true only when a successful, article-bearing ingest landed within the threshold. */
  healthy: boolean;
  state: FreshnessState;
  /** completed_at of the most recent successful ingest with articles_fetched > 0. */
  lastSuccessfulIngestAt: string | null;
  /** Age of that ingest in hours (null when none found or DB unreachable). */
  ageHours: number | null;
  thresholdHours: number;
  /** articles_fetched on that most recent successful ingest. */
  articlesLastRun: number | null;
  /** Human-readable one-liner for the alert email / health payload. */
  detail: string;
}

/**
 * Read the freshness of the ingestion pipeline from pipeline_runs.
 *
 * @param opts.thresholdHours  Staleness threshold (default 30h ≈ one missed daily cycle + grace).
 * @param opts.now             Injectable clock for tests (defaults to Date.now()).
 * @returns FreshnessStatus — never throws; a DB failure becomes state:'error', healthy:false.
 */
export async function checkPipelineFreshness(opts?: {
  thresholdHours?: number;
  now?: number;
}): Promise<FreshnessStatus> {
  const thresholdHours = opts?.thresholdHours ?? DEFAULT_STALENESS_THRESHOLD_HOURS;
  const now = opts?.now ?? Date.now();

  try {
    const supabase = createAdminClient();

    // Most recent ingest that actually STORED articles. We deliberately require
    // status='completed' AND articles_fetched > 0 — the fail-closed gate in the
    // pipeline marks all-sources-empty runs as 'failed', so a run that merely
    // "finished" is not proof the data is fresh.
    const { data, error } = await supabase
      .from('pipeline_runs')
      .select('completed_at, started_at, articles_fetched')
      .eq('run_type', 'ingest')
      .eq('status', 'completed')
      .gt('articles_fetched', 0)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(1);

    // FAIL CLOSED: a DB error is the paused-Supabase signature. Alert, don't pass.
    if (error) {
      return {
        healthy: false,
        state: 'error',
        lastSuccessfulIngestAt: null,
        ageHours: null,
        thresholdHours,
        articlesLastRun: null,
        detail: `Cannot read pipeline_runs (DB unreachable — Supabase paused/down?): ${error.message}`,
      };
    }

    const row = data?.[0];
    if (!row) {
      return {
        healthy: false,
        state: 'stale',
        lastSuccessfulIngestAt: null,
        ageHours: null,
        thresholdHours,
        articlesLastRun: null,
        detail: 'No successful article-bearing ingest found in pipeline_runs at all.',
      };
    }

    const stamp = row.completed_at ?? row.started_at;
    const stampMs = stamp ? new Date(stamp).getTime() : NaN;
    if (!stamp || Number.isNaN(stampMs)) {
      return {
        healthy: false,
        state: 'error',
        lastSuccessfulIngestAt: stamp ?? null,
        ageHours: null,
        thresholdHours,
        articlesLastRun: row.articles_fetched ?? null,
        detail: `Latest successful ingest has an unparseable timestamp: ${String(stamp)}`,
      };
    }

    const ageHours = (now - stampMs) / (1000 * 60 * 60);
    const stale = ageHours > thresholdHours;

    return {
      healthy: !stale,
      state: stale ? 'stale' : 'fresh',
      lastSuccessfulIngestAt: stamp,
      ageHours: Math.round(ageHours * 10) / 10,
      thresholdHours,
      articlesLastRun: row.articles_fetched ?? null,
      detail: stale
        ? `Last article-bearing ingest was ${Math.round(ageHours * 10) / 10}h ago (threshold ${thresholdHours}h) — pipeline may be dead.`
        : `Pipeline healthy: last ingest ${Math.round(ageHours * 10) / 10}h ago stored ${row.articles_fetched} articles.`,
    };
  } catch (err) {
    // FAIL CLOSED on any thrown error (network, client init, unexpected shape).
    const msg = err instanceof Error ? err.message : String(err);
    return {
      healthy: false,
      state: 'error',
      lastSuccessfulIngestAt: null,
      ageHours: null,
      thresholdHours,
      articlesLastRun: null,
      detail: `Freshness check threw (treating as unhealthy): ${msg}`,
    };
  }
}
