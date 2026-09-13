// ═══════════════════════════════════════════════════════════════
// Bounded retry for TRANSIENT Supabase/PostgREST failures.
//
// Added 2026-09-13 after the 2026-09-12 incident: the shared Supabase
// project returned a bare HTTP 504 "Gateway Timeout" twice that day —
// at 04:00:29Z on /api/ingest's very first write (the pipeline_runs
// insert), and at 12:00:13Z on all three /api/monitor reads. Between
// those two moments the site and the 04:05Z /api/process run worked
// normally, so the DB was up but intermittently unresponsive (the tail
// of Supabase's 09-10/09-11 "Unresponsive Projects" incident on Nano
// compute). Because every DB call was single-shot, ONE 504 discarded the
// whole day's ingest — the cron does not re-run — and the monitor
// reported "DB unreachable" for a database that answered the next
// request.
//
// This helper retries only the transient class (5xx from the gateway,
// network resets) a small bounded number of times. It deliberately does
// NOT retry application errors (a paused project's error, a bad column,
// RLS, JWT) — those are real and the callers' fail-closed handling must
// see them unchanged. After the last attempt the last result is returned
// (or the last error rethrown) exactly as it would have been without
// retry, so no caller's contract changes.
// ═══════════════════════════════════════════════════════════════

/** Matches supabase-js's surfacing of a non-JSON gateway response (message = statusText). */
const TRANSIENT_MESSAGE = /gateway timeout|bad gateway|service unavailable|fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|network error|terminating connection|too many connections|connection reset/i;

/** PostgREST puts the HTTP status in `code` when the body was not a JSON error. */
const TRANSIENT_CODE = /^5\d\d$/;

/** Default backoff between attempts: 3 attempts total, ~4s of waiting. Fits a 30s route budget with margin. */
export const DEFAULT_RETRY_DELAYS_MS = [1000, 3000];

export function isTransientDbError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { message?: unknown; code?: unknown };
  const message = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';
  return TRANSIENT_CODE.test(code) || TRANSIENT_MESSAGE.test(message);
}

export interface DbRetryOptions {
  /** Waits between attempts; attempts = delaysMs.length + 1. */
  delaysMs?: number[];
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Included in the console warning so the retry is visible in Vercel logs. */
  label?: string;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Run a Supabase query thunk, retrying on transient failure.
 *
 * `op` must build a FRESH request on each call (e.g. `() => supabase.from(...).select(...)`);
 * a PostgrestBuilder is a thenable that re-executes when awaited again, but
 * building it fresh each time keeps this safe regardless.
 */
export async function withDbRetry<T extends { error: unknown }>(
  op: () => PromiseLike<T>,
  opts: DbRetryOptions = {},
): Promise<T> {
  const delays = opts.delaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const sleep = opts.sleep ?? defaultSleep;
  const label = opts.label ?? 'db';
  const attempts = delays.length + 1;

  for (let attempt = 1; ; attempt++) {
    let result: T | undefined;
    let thrown: unknown;
    try {
      result = await op();
    } catch (err) {
      thrown = err;
    }

    const failure = thrown ?? result?.error;
    const transient = isTransientDbError(failure);

    if (!failure || !transient || attempt >= attempts) {
      if (thrown) throw thrown;
      return result as T;
    }

    const wait = delays[attempt - 1];
    const msg = failure instanceof Error ? failure.message : (failure as { message?: string }).message;
    console.warn(`[db-retry] ${label}: transient error on attempt ${attempt}/${attempts} (${msg}); retrying in ${wait}ms`);
    await sleep(wait);
  }
}
