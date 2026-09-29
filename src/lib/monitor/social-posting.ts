// ═══════════════════════════════════════════════════════════════
// Social-posting check — the FOURTH dead-man's-switch failure mode.
//
// The 3x/day social posts are made by scripts/outreach/scheduler.ts, run by
// Windows Task Scheduler on Steve's PC. On 2026-09-05 the tasks were repointed
// at a hidden-window wrapper whose unquoted `&&` made the outer batch run tsx
// from the wrong directory; the log redirect failed, tsx never started, and
// the batch still exited 0. Every task reported "Last Result: 0" for three
// weeks while nothing was posted — the success signal (a public post) simply
// stopped, and nothing watched for its ABSENCE.
//
// This check watches the outcome, not the machinery: it reads the account's
// newest public post from Bluesky's unauthenticated AppView and alarms when it
// is older than the threshold. It runs inside the Vercel /api/monitor cron, so
// it is independent of the PC, its task definitions, and its logs. Bluesky is
// the canary because it is the one platform posted on every slot via a stable
// API (Mastodon/LinkedIn ride the same run, so a dead run stops all of them).
//
// FAILS CLOSED: an API error, network error or empty feed is unhealthy.
// Known blind spot: a manual post from the same account resets the clock.
// ═══════════════════════════════════════════════════════════════

/**
 * Hours without a post before alerting. The scheduler posts ~3x/day
 * (~13:30, ~19:30, ~01:00 UTC), so the normal max gap is ~12.5h. 36h means
 * "a whole posting day was missed" — a single late or failed slot, or a PC
 * that was off for an evening, does not page anyone.
 */
export const DEFAULT_SOCIAL_STALENESS_HOURS = 36;

/** The account the scheduler posts from (public; also linked on /about). */
export const DEFAULT_BLUESKY_HANDLE = 'sgharlow.bsky.social';

const FEED_URL = 'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed';

export type SocialPostingState = 'ok' | 'stale' | 'error';

export interface SocialPostingStatus {
  healthy: boolean;
  state: SocialPostingState;
  handle: string;
  /** indexedAt of the newest original post by the account, or null if none. */
  lastPostAt: string | null;
  ageHours: number | null;
  thresholdHours: number;
  detail: string;
}

interface FeedItem {
  post?: { author?: { handle?: string }; indexedAt?: string };
  reason?: unknown; // present for reposts / pins — not an original post
}

/**
 * Check that the outreach account has posted recently.
 *
 * @param opts.handle         Bluesky handle (default BLUESKY_HANDLE env, then DEFAULT_BLUESKY_HANDLE)
 * @param opts.thresholdHours Staleness threshold (default 36)
 * @param opts.now            Injectable clock for tests
 * @param opts.fetchImpl      Injectable fetch for tests
 * @returns never throws; any failure becomes state:'error' (unhealthy)
 */
export async function checkSocialPosting(opts?: {
  handle?: string;
  thresholdHours?: number;
  now?: number;
  fetchImpl?: typeof fetch;
}): Promise<SocialPostingStatus> {
  const handle = opts?.handle ?? process.env.BLUESKY_HANDLE ?? DEFAULT_BLUESKY_HANDLE;
  const thresholdHours = opts?.thresholdHours ?? DEFAULT_SOCIAL_STALENESS_HOURS;
  const now = opts?.now ?? Date.now();
  const fetchImpl = opts?.fetchImpl ?? fetch;

  const base = { handle, thresholdHours };

  try {
    const url = `${FEED_URL}?actor=${encodeURIComponent(handle)}&limit=25&filter=posts_no_replies`;
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) {
      return {
        ...base, healthy: false, state: 'error', lastPostAt: null, ageHours: null,
        detail: `Bluesky author feed for ${handle} returned HTTP ${res.status} — cannot confirm posting (treating as unhealthy).`,
      };
    }

    const body = (await res.json()) as { feed?: FeedItem[] };
    const times = (body.feed ?? [])
      .filter((it) => !it.reason && it.post?.author?.handle === handle && it.post?.indexedAt)
      .map((it) => it.post!.indexedAt as string)
      .filter((t) => !Number.isNaN(Date.parse(t)))
      .sort((a, b) => Date.parse(b) - Date.parse(a));

    if (times.length === 0) {
      return {
        ...base, healthy: false, state: 'stale', lastPostAt: null, ageHours: null,
        detail: `No original posts found for ${handle} — the outreach scheduler is not posting.`,
      };
    }

    const lastPostAt = times[0];
    const ageHours = Math.round(((now - Date.parse(lastPostAt)) / 3_600_000) * 10) / 10;

    if (ageHours > thresholdHours) {
      return {
        ...base, healthy: false, state: 'stale', lastPostAt, ageHours,
        detail: `No Bluesky post from ${handle} in ${ageHours}h (threshold ${thresholdHours}h; last ${lastPostAt}). The PC outreach scheduler has stopped posting.`,
      };
    }

    return {
      ...base, healthy: true, state: 'ok', lastPostAt, ageHours,
      detail: `Last Bluesky post from ${handle} ${ageHours}h ago (threshold ${thresholdHours}h).`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ...base, healthy: false, state: 'error', lastPostAt: null, ageHours: null,
      detail: `Social-posting check threw (treating as unhealthy): ${msg}`,
    };
  }
}
