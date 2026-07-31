// ═══════════════════════════════════════════════════════════════
// Stuck-live-week check — the SECOND failure mode the July 2026
// outage exposed.
//
// Freezing is driven by a single weekly cron (/api/freeze, Sundays 05:00
// UTC) that freezes the *previous* week. There is no retroactive week-level
// freeze: if that cron's window is missed (e.g. Supabase paused), the week
// stays status='live' forever and nothing signals it. Week 2026-07-05's
// freeze fell during the pause and sat unfrozen for 3 weeks, undetected.
//
// This check flags any week still 'live' more than a grace period past its
// own scheduled freeze time, so the dead-man's-switch catches a missed freeze
// the same way it catches a dead ingest. FAILS CLOSED on a DB error.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * The freeze cron ("0 5 * * 0") runs at 05:00 UTC on the Sunday that STARTS
 * the following week and freezes the week that just ended. So a week whose
 * week_id (Sunday) is `ws` is scheduled to freeze at ws + 7 days + 5 hours.
 */
const FREEZE_OFFSET_MS = (7 * 24 + 5) * 60 * 60 * 1000;

/** Grace after the scheduled freeze time before we call a still-live week "stuck". */
export const DEFAULT_FREEZE_GRACE_HOURS = 24;

export type StuckWeekState = 'ok' | 'stuck' | 'error';

export interface StuckWeekStatus {
  healthy: boolean;
  state: StuckWeekState;
  /** week_ids still 'live' past their freeze window + grace. */
  stuckWeeks: string[];
  detail: string;
}

/**
 * Detect weeks stuck in 'live' status (missed freeze cron).
 *
 * A live week is "stuck" when `now` is more than `graceHours` past that week's
 * own scheduled freeze time (ws + 7d + 5h). This naturally excludes the current
 * week (freeze time in the future) and the just-ended week during its grace
 * window, while catching any older week that should have frozen but didn't.
 *
 * @param opts.graceHours Hours past the scheduled freeze before flagging (default 24).
 * @param opts.now        Injectable clock for tests (defaults to Date.now()).
 * @returns StuckWeekStatus — never throws; a DB error becomes state:'error'.
 */
export async function checkStuckWeeks(opts?: {
  graceHours?: number;
  now?: number;
}): Promise<StuckWeekStatus> {
  const graceHours = opts?.graceHours ?? DEFAULT_FREEZE_GRACE_HOURS;
  const now = opts?.now ?? Date.now();
  const graceMs = graceHours * 60 * 60 * 1000;

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('weekly_snapshots')
      .select('week_id, status')
      .eq('status', 'live');

    if (error) {
      return {
        healthy: false,
        state: 'error',
        stuckWeeks: [],
        detail: `Cannot read weekly_snapshots (DB unreachable — Supabase paused/down?): ${error.message}`,
      };
    }

    const liveWeeks = (data ?? []).map((w) => w.week_id).filter(Boolean) as string[];

    const stuckWeeks = liveWeeks
      .filter((wk) => {
        // week_id is the Sunday that starts the week, "YYYY-MM-DD" (UTC midnight).
        const wsMs = new Date(`${wk}T00:00:00Z`).getTime();
        if (Number.isNaN(wsMs)) return false; // unparseable — don't crash the whole check
        const freezeDueMs = wsMs + FREEZE_OFFSET_MS;
        return now > freezeDueMs + graceMs;
      })
      .sort();

    if (stuckWeeks.length === 0) {
      return {
        healthy: true,
        state: 'ok',
        stuckWeeks: [],
        detail: 'No stuck-live weeks — every past week is frozen (or within its freeze grace window).',
      };
    }

    return {
      healthy: false,
      state: 'stuck',
      stuckWeeks,
      detail: `${stuckWeeks.length} week(s) still 'live' past their freeze window (+${graceHours}h grace): ${stuckWeeks.join(', ')}. A freeze cron was missed.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      healthy: false,
      state: 'error',
      stuckWeeks: [],
      detail: `Stuck-week check threw (treating as unhealthy): ${msg}`,
    };
  }
}
