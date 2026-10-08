// ═══════════════════════════════════════════════════════════════
// Substack weekly-publish dead-man's switch — pure verdict logic.
//
// WHY (2026-10-07). The Sunday Windows task DistractionIndex-WeeklyCascade
// (scripts/outreach/substack-publish.ts, Steve's PC, Sun 09:00Z) failed
// silently from ~March to 2026-10-04: the Substack session had expired and a
// failure only set an exit code nobody reads. Weeks 64-91 never reached
// distractionindex.substack.com and nothing said so. A job cannot report its
// own absence, so .github/workflows/substack-deadman.yml checks for the
// outcome from the cloud and opens a priority-high issue (read by
// /daily-priority) when the expected week is not there.
//
// HEARTBEAT, NOT SUBSTACK (2026-10-07, second design). Substack answers HTTP
// 403 to GitHub-hosted runners on its public listings (measured on run
// 37729669794), so the cloud cannot read Substack. Instead the publish run
// itself — only after it has seen the post on the logged-in dashboard's
// Published list — writes the week number to the GitHub Actions repository
// variable SUBSTACK_LAST_PUBLISHED_WEEK (scripts/outreach/substack-verify.ts).
// The workflow reads that variable through the `vars` context; this module
// judges it. Absence of a fresh heartbeat is what alerts.
//
// This module only decides. It ALERTS only — it must never be used to decide
// to re-publish anything (a duplicate emails every subscriber).
// ═══════════════════════════════════════════════════════════════

export type SubstackState = 'OK' | 'MISSING' | 'ERROR';

export interface Verdict {
  state: SubstackState;
  /** The week number the Sunday run should have published by now. */
  expected: number;
  /** The week number in the heartbeat, or null if it is missing/unreadable. */
  newest: number | null;
  reason: string;
}

/** The GitHub Actions repository variable the verified publish writes. */
export const HEARTBEAT_VAR = 'SUBSTACK_LAST_PUBLISHED_WEEK';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Week 1 starts Sun 2024-12-29 (same epoch as src/lib/weeks FIRST_WEEK_START). */
const WEEK_1_START_MS = Date.UTC(2024, 11, 29);

/**
 * When the run for a week counts as overdue, measured from that week's start:
 * the week ends 7 days later, freezes Sun 05:00Z, the cascade publishes at
 * Sun 09:00Z, and the run is only judged once it is 24h past (Mon 09:00Z).
 */
const DUE_AFTER_WEEK_START_MS = 7 * DAY_MS + 9 * HOUR_MS + 24 * HOUR_MS;

/**
 * The number of the newest week whose Sunday publish should be done at `now`.
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

/**
 * Judge the heartbeat variable's raw value against the expected week.
 *   - unset / empty / not a positive integer      → ERROR (alerts, never OK)
 *   - more than one week ahead of the calendar    → ERROR (a bad write must not
 *     mask months of silence; one ahead is normal between the Sunday publish
 *     and the Monday 09:00Z due time)
 *   - >= expected → OK;  < expected → MISSING
 */
export function evaluateHeartbeat(raw: unknown, expected: number): Verdict {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return {
      state: 'ERROR', expected, newest: null,
      reason: `heartbeat ${HEARTBEAT_VAR} is not set — no verified publish has been recorded, so Week ${expected} cannot be shown published`,
    };
  }
  const value = raw.trim();
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    const shown = value.length > 40 ? `${value.slice(0, 40)}…` : value;
    return {
      state: 'ERROR', expected, newest: null,
      reason: `heartbeat ${HEARTBEAT_VAR} is "${shown.replace(/[\r\n]+/g, ' ')}" — not a week number`,
    };
  }
  const newest = Number(value);
  if (newest > expected + 1) {
    return {
      state: 'ERROR', expected, newest,
      reason: `heartbeat ${HEARTBEAT_VAR} says Week ${newest}, which is ahead of the calendar (expected Week ${expected}) — the value is wrong`,
    };
  }
  if (newest >= expected) {
    return { state: 'OK', expected, newest, reason: `last verified publish is Week ${newest} (expected Week ${expected})` };
  }
  return {
    state: 'MISSING', expected, newest,
    reason: `last verified publish is Week ${newest}; no heartbeat for Week ${expected}`,
  };
}
