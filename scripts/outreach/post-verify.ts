/**
 * Verify-after-post for the Playwright posters (LinkedIn, Threads).
 *
 * WHY (2026-10-11). Every browser poster clicked "Post", waited a fixed 3–5 s, reported
 * success and closed the browser, without checking the post existed. The same shape cost
 * Week 93 on Substack, where the send needs ~45 s and closing early cancelled it (see
 * substack-verify.ts). On 2026-10-11 LinkedIn's published list did hold every post the
 * history claimed, so LinkedIn usually finishes inside its wait. But that success was a
 * guess the code never checked, and one run (10-05) logged a timeout for a post that went
 * out anyway.
 *
 * The check is a count, not a presence test: read the page's own list BEFORE posting,
 * count the entries that open like this post, and require the count to RISE afterwards.
 * Morning and midday posts can share an opening line, so "the text is on the page" would
 * verify an earlier post. A list that cannot be read is null (unknown), never 0.
 *
 * Nothing here posts. The page is injected (a Playwright Page satisfies ListPage), so the
 * logic is unit-tested in tests/scripts/post-verify.test.ts.
 */

/** Errors starting with this mean: Post was clicked, the result is unknown — never retry. */
export const UNVERIFIED_PREFIX = 'POSTED-UNVERIFIED';

/** The subset of a Playwright Page these helpers use. */
export interface ListPage {
  goto(url: string, opts?: { waitUntil?: 'domcontentloaded'; timeout?: number }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  url(): string;
  innerText(selector: string): Promise<string>;
}

const SIGN_IN = /login|authwall|checkpoint|\/uas\/|sign-?in/i;

function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * The normalised opening of a post, cut before its first URL (LinkedIn rewrites links to
 * lnkd.in) and capped so a list that truncates long posts with "…see more" still matches.
 */
export function postFingerprint(text: string, maxLen = 80): string {
  const beforeUrl = text.split(/https?:\/\//i)[0];
  return normalize(beforeUrl).slice(0, maxLen).trim();
}

/** How many times the fingerprint occurs in the page text. An empty fingerprint matches nothing. */
export function countOnPage(pageText: string, fingerprint: string): number {
  if (!fingerprint) return 0;
  const body = normalize(pageText);
  let n = 0;
  for (let i = body.indexOf(fingerprint); i !== -1; i = body.indexOf(fingerprint, i + fingerprint.length)) n++;
  return n;
}

/** Load the list and count. A sign-in wall or a failed read is null (unknown), never 0. */
export async function readListCount(
  page: ListPage,
  listUrl: string,
  fingerprint: string,
  opts: { settleMs?: number } = {},
): Promise<{ count: number | null; reason: string }> {
  try {
    await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(opts.settleMs ?? 10_000);
    const url = page.url();
    if (SIGN_IN.test(url)) return { count: null, reason: `list redirected to sign-in (${url})` };
    const count = countOnPage(await page.innerText('body'), fingerprint);
    return { count, reason: `${count} matching entr${count === 1 ? 'y' : 'ies'} on the list` };
  } catch (e) {
    return { count: null, reason: `list read failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 150)}` };
  }
}

/**
 * Poll until the composer has gone (the platform accepted the post). Navigating away while
 * it is still open can cancel the post, as it did on Substack.
 */
export async function waitUntilGone(
  page: Pick<ListPage, 'waitForTimeout'>,
  stillVisible: () => Promise<boolean>,
  opts: { timeoutMs?: number; pollMs?: number } = {},
): Promise<{ gone: boolean; waitedMs: number }> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const pollMs = opts.pollMs ?? 2_000;
  let waitedMs = 0;
  while (waitedMs < timeoutMs) {
    await page.waitForTimeout(pollMs);
    waitedMs += pollMs;
    if (!(await stillVisible().catch(() => false))) return { gone: true, waitedMs };
  }
  return { gone: false, waitedMs };
}

/** Re-read the list until the count rises above `before`; retry over ~40 s by default. */
export async function confirmNewPost(args: {
  page: ListPage;
  listUrl: string;
  fingerprint: string;
  before: number;
  attempts?: number;
  settleMs?: number;
  retryGapMs?: number;
  log?: (m: string) => void;
}): Promise<{ verified: boolean; checks: number; after: number | null; reason: string }> {
  const attempts = args.attempts ?? 3;
  const retryGapMs = args.retryGapMs ?? 10_000;
  const log = args.log ?? console.log;
  let after: number | null = null;
  let reason = 'no check ran';
  for (let i = 1; i <= attempts; i++) {
    const r = await readListCount(args.page, args.listUrl, args.fingerprint, { settleMs: args.settleMs });
    after = r.count;
    if (r.count !== null && r.count > args.before) {
      return { verified: true, checks: i, after, reason: `new post on the list (${args.before} -> ${r.count}, check ${i}/${attempts})` };
    }
    reason = r.count === null ? r.reason : `no new entry yet (${args.before} -> ${r.count})`;
    log(`    verify check ${i}/${attempts}: ${reason}`);
    if (i < attempts) await args.page.waitForTimeout(retryGapMs);
  }
  return { verified: false, checks: attempts, after, reason };
}

export function isUnverified(error?: string): boolean {
  return typeof error === 'string' && error.startsWith(UNVERIFIED_PREFIX);
}

export function linkedInListUrl(companyId: string): string {
  return `https://www.linkedin.com/company/${companyId}/admin/page-posts/published/`;
}

/**
 * The Threads profile that lists the account's posts: THREADS_PROFILE_URL, else built from a
 * THREADS_USERNAME handle. An email username cannot name a profile, so it gives null.
 * ⚠️ GUESS: Threads posting is disabled (scheduler.ts) and this page's list text has not been
 * captured live. Re-enabling Threads needs one live proof of this check first.
 */
export function threadsProfileUrl(env: Record<string, string | undefined>): string | null {
  if (env.THREADS_PROFILE_URL) return env.THREADS_PROFILE_URL;
  const u = env.THREADS_USERNAME?.trim();
  if (!u || u.includes('@')) return null;
  return `https://www.threads.net/@${u}`;
}
