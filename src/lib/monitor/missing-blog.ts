// ═══════════════════════════════════════════════════════════════
// Missing-blog check — the THIRD failure mode, and the one that ran
// undetected the longest.
//
// Blog posts are written by the freeze cascade (src/lib/blog/cascade.ts),
// which /api/freeze invokes AFTER it has already logged the freeze and a
// pipeline_runs row with status='completed'. The cascade's own failures are
// swallowed into a response object nobody reads, so a blog that never writes
// produces NO signal at all: the week looks frozen, the run looks completed.
//
// That is exactly what happened for weeks 67-83. The freeze route runs at
// maxDuration=30s while the blog call was made against Sonnet (~46-50s), so
// Vercel hard-killed the function before the insert. A platform timeout is not
// a catchable JS error, so even the cascade's try/catch never fired. Seventeen
// weeks froze with no blog and nothing anywhere said so.
//
// Switching the cascade to Haiku (~20s) removed THAT cause, but not the class:
// an API error, malformed JSON, or the MIN_WORDS publish gate throwing would
// all still fail silently. Per the dead-man's-switch rule, a success signal
// that is a written row must have its ABSENCE monitored. This check is that
// absence monitor. FAILS CLOSED on a DB error.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Same schedule arithmetic as stuck-week.ts: the freeze cron ("0 5 * * 0")
 * fires 05:00 UTC on the Sunday that starts the FOLLOWING week, so a week
 * whose week_id (Sunday) is `ws` is due to freeze at ws + 7 days + 5 hours.
 */
const FREEZE_OFFSET_MS = (7 * 24 + 5) * 60 * 60 * 1000;

/**
 * Grace after a week's freeze before a missing blog counts as a failure.
 * Small but non-zero: the cascade runs inside the freeze request, so the blog
 * lands seconds after the snapshot flips to 'frozen'. The grace only exists to
 * avoid flagging a week whose cascade is genuinely still in flight.
 */
export const DEFAULT_BLOG_GRACE_HOURS = 6;

export type MissingBlogState = 'ok' | 'missing' | 'error';

export interface MissingBlogStatus {
  healthy: boolean;
  state: MissingBlogState;
  /** week_ids that are frozen, have scored events, and have no blog post. */
  missingWeeks: string[];
  detail: string;
}

/**
 * Detect frozen weeks whose blog post never got written.
 *
 * A frozen week is only counted as "missing" when ALL of these hold:
 *   1. status='frozen' and more than `graceHours` past its freeze time — a
 *      just-frozen week inside the grace window is still legitimately pending.
 *   2. No row in blog_posts for that week_id.
 *   3. The week actually has scored events. A week with nothing scored has no
 *      blog BY DESIGN — cascade.ts returns null and the backlog script skips
 *      it — so flagging it would be a permanent false positive.
 *
 * @param opts.graceHours Hours past freeze before flagging (default 6).
 * @param opts.now        Injectable clock for tests (defaults to Date.now()).
 * @returns MissingBlogStatus — never throws; a DB error becomes state:'error'.
 */
export async function checkMissingBlogs(opts?: {
  graceHours?: number;
  now?: number;
}): Promise<MissingBlogStatus> {
  const graceHours = opts?.graceHours ?? DEFAULT_BLOG_GRACE_HOURS;
  const now = opts?.now ?? Date.now();
  const graceMs = graceHours * 60 * 60 * 1000;

  try {
    const supabase = createAdminClient();

    const { data: frozen, error: weeksError } = await supabase
      .from('weekly_snapshots')
      .select('week_id, frozen_at')
      .eq('status', 'frozen');

    if (weeksError) {
      return {
        healthy: false,
        state: 'error',
        missingWeeks: [],
        detail: `Cannot read weekly_snapshots (DB unreachable — Supabase paused/down?): ${weeksError.message}`,
      };
    }

    const { data: blogs, error: blogsError } = await supabase
      .from('blog_posts')
      .select('week_id');

    if (blogsError) {
      return {
        healthy: false,
        state: 'error',
        missingWeeks: [],
        detail: `Cannot read blog_posts (DB unreachable — Supabase paused/down?): ${blogsError.message}`,
      };
    }

    const haveBlog = new Set((blogs ?? []).map((b) => b.week_id).filter(Boolean));

    // Weeks past their grace window with no blog row — candidates only; each
    // still has to prove it had events before we call it a failure.
    const candidates = (frozen ?? [])
      .map((w) => w.week_id as string)
      .filter(Boolean)
      .filter((wk) => !haveBlog.has(wk))
      .filter((wk) => {
        const wsMs = new Date(`${wk}T00:00:00Z`).getTime();
        if (Number.isNaN(wsMs)) return false; // unparseable — don't crash the check
        return now > wsMs + FREEZE_OFFSET_MS + graceMs;
      })
      .sort();

    // Drop candidates that have no scored events (no blog is correct for them).
    const missingWeeks: string[] = [];
    for (const wk of candidates) {
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id')
        .eq('week_id', wk)
        .not('primary_list', 'is', null);

      if (eventsError) {
        return {
          healthy: false,
          state: 'error',
          missingWeeks: [],
          detail: `Cannot read events for ${wk} (DB unreachable?): ${eventsError.message}`,
        };
      }

      if ((events ?? []).length > 0) missingWeeks.push(wk);
    }

    if (missingWeeks.length === 0) {
      return {
        healthy: true,
        state: 'ok',
        missingWeeks: [],
        detail: 'No missing blog posts — every frozen week with scored events has one.',
      };
    }

    return {
      healthy: false,
      state: 'missing',
      missingWeeks,
      detail:
        `${missingWeeks.length} frozen week(s) with scored events have NO blog post: ` +
        `${missingWeeks.join(', ')}. The freeze cascade's blog step failed silently. ` +
        `Backfill with: npx tsx scripts/generate-blog-backlog.ts`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      healthy: false,
      state: 'error',
      missingWeeks: [],
      detail: `Missing-blog check threw (treating as unhealthy): ${msg}`,
    };
  }
}
