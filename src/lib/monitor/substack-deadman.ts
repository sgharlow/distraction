// ═══════════════════════════════════════════════════════════════
// Substack weekly-publish dead-man's switch — pure verdict logic.
//
// WHY (2026-10-07). The Sunday Windows task DistractionIndex-WeeklyCascade
// (scripts/outreach/substack-publish.ts, Steve's PC, Sun 09:00Z) failed
// silently from ~March to 2026-10-04: the Substack session had expired and a
// failure only set an exit code nobody reads. Weeks 64-91 never reached
// distractionindex.substack.com and nothing said so. A job cannot report its
// own absence, so .github/workflows/substack-deadman.yml checks the OUTCOME —
// the public post list — from the cloud, and opens a priority-high issue
// (read by /daily-priority) when the expected week is not there.
//
// This module only decides; scripts/outreach/substack-deadman.ts fetches and
// writes the verdict, and the workflow raises or clears the issue. It ALERTS
// only — it must never be used to decide to re-publish anything (the archive
// endpoint lags: measured 2026-10-08, it still listed Week 63 after Week 92
// was live, while /api/v1/posts already listed Week 92).
// ═══════════════════════════════════════════════════════════════

export type SubstackState = 'OK' | 'MISSING' | 'ERROR';

export interface Verdict {
  state: SubstackState;
  /** The week number the Sunday run should have published by now. */
  expected: number;
  /** Highest "Week N" found in the listing, or null if none. */
  newest: number | null;
  reason: string;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Week 1 starts Sun 2024-12-29 (same epoch as src/lib/weeks FIRST_WEEK_START). */
const WEEK_1_START_MS = Date.UTC(2024, 11, 29);

/**
 * When the run for a week counts as overdue, measured from that week's start:
 * the week ends 7 days later, freezes Sun 05:00Z, the cascade publishes at
 * Sun 09:00Z, and the run is only judged once it is 24h past (Mon 09:00Z) —
 * which also gives the lagging public listings a day to catch up.
 */
const DUE_AFTER_WEEK_START_MS = 7 * DAY_MS + 9 * HOUR_MS + 24 * HOUR_MS;

/**
 * The number of the newest week whose Sunday publish should be visible at `now`.
 * Mon 2026-10-12 15:00Z → 93; Sun 2026-10-11 03:00Z → 92.
 * Throws RangeError on an invalid date or a clock before Week 1 was due —
 * a week judged off a bad clock is a false alert or a silent pass.
 */
export function expectedWeek(now: Date): number {
  const t = now.getTime();
  if (Number.isNaN(t)) throw new RangeError('substack dead-man: invalid date');
  const sinceFirstDue = t - (WEEK_1_START_MS + DUE_AFTER_WEEK_START_MS);
  if (sinceFirstDue < 0) {
    throw new RangeError(`substack dead-man: ${now.toISOString()} is before Week 1 was due`);
  }
  return Math.floor(sinceFirstDue / (7 * DAY_MS)) + 1;
}

/** "Week 92: The Mail-In ..." → 92; anything else → null. */
export function weekFromTitle(title: unknown): number | null {
  if (typeof title !== 'string') return null;
  const m = /^\s*Week\s+(\d+)\b/i.exec(title);
  return m ? Number(m[1]) : null;
}

/**
 * Judge a public post listing against the expected week.
 * An empty, non-array or wholly unparseable listing is ERROR — it alerts and is
 * never read as OK.
 */
export function evaluate(items: unknown, expected: number): Verdict {
  if (!Array.isArray(items)) {
    return { state: 'ERROR', expected, newest: null, reason: 'post listing is not an array — cannot show Week ' + expected + ' was published' };
  }
  if (items.length === 0) {
    return { state: 'ERROR', expected, newest: null, reason: 'post listing is empty — cannot show Week ' + expected + ' was published' };
  }
  const weeks = items
    .map((it) => weekFromTitle((it as { title?: unknown } | null)?.title))
    .filter((n): n is number => n !== null);
  if (weeks.length === 0) {
    return { state: 'ERROR', expected, newest: null, reason: `none of ${items.length} listed posts has a "Week N" title — cannot show Week ${expected} was published` };
  }
  const newest = Math.max(...weeks);
  if (newest >= expected) {
    return { state: 'OK', expected, newest, reason: `newest published is Week ${newest} (expected Week ${expected})` };
  }
  return {
    state: 'MISSING', expected, newest,
    reason: `newest published is Week ${newest}; Week ${expected} is not on Substack`,
  };
}

export interface ListingSource {
  source: string;
  body?: unknown;
  error?: string;
}

/**
 * Union several public listings (the lagging archive + the fresh posts list).
 * A post seen in ANY listing counts as published; a failed or mis-shaped
 * source is recorded in `errors` and contributes nothing.
 */
export function mergeListings(sources: ListingSource[]): { items: unknown[]; errors: string[] } {
  const items: unknown[] = [];
  const errors: string[] = [];
  for (const s of sources) {
    if (s.error !== undefined) {
      errors.push(`${s.source}: ${s.error}`);
    } else if (!Array.isArray(s.body)) {
      errors.push(`${s.source}: response is not an array`);
    } else {
      items.push(...s.body);
    }
  }
  return { items, errors };
}
