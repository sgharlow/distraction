import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  postFingerprint,
  countOnPage,
  readListCount,
  waitUntilGone,
  confirmNewPost,
  isUnverified,
  threadsProfileUrl,
  linkedInListUrl,
  UNVERIFIED_PREFIX,
  type ListPage,
} from '../../scripts/outreach/post-verify';

// captured_from: LinkedIn company admin "published" list, read-only via the scheduler's own
// .linkedin-session on 2026-10-11 (scratchpad linkedin-peek.mjs). LinkedIn shortened the URL
// to lnkd.in. ORIGINAL_POST is reconstructed from that capture; its URL is a GUESS, and the
// fingerprint stops before any URL precisely because LinkedIn rewrites links.
const CAPTURED_LIST = [
  'The Distraction Index',
  '3 followers',
  '10h • ',
  ' ',
  "This week's Distraction Index (2026-10-11):",
  '4 events scored.',
  'Highest constitutional damage: "Trump Medicaid Cuts Strip Legal Immigrants and Refugees of Health Coverage" (18.9/100)',
  'Top distraction: "Trump Executive Order on Childhood Vaccine Schedule" (36.5/100)',
  'Full report: https://lnkd.in/g-eZM2BY',
].join('\n');
const ORIGINAL_POST = [
  "This week's Distraction Index (2026-10-11):",
  '4 events scored.',
  'Highest constitutional damage: "Trump Medicaid Cuts Strip Legal Immigrants and Refugees of Health Coverage" (18.9/100)',
  'Top distraction: "Trump Executive Order on Childhood Vaccine Schedule" (36.5/100)',
  'Full report: https://distractionindex.org/week/2026-10-11',
].join('\n');
const LIST_URL = 'https://www.linkedin.com/company/123/admin/page-posts/published/';

/** A fake page: each innerText('body') returns the next entry (an Error is thrown); url() the next url. */
function fakeListPage(bodies: (string | Error)[], urls: string[] = [LIST_URL]) {
  const calls = { goto: [] as string[], waits: [] as number[], reads: 0, urlReads: 0 };
  const page: ListPage = {
    goto: async (u: string) => {
      calls.goto.push(u);
      return null;
    },
    waitForTimeout: async (ms: number) => {
      calls.waits.push(ms);
    },
    url: () => urls[Math.min(calls.urlReads++, urls.length - 1)],
    innerText: async () => {
      const next = bodies[Math.min(calls.reads, bodies.length - 1)];
      calls.reads++;
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return { page, calls };
}

describe('postFingerprint', () => {
  it('collapses whitespace, normalises quotes and stops before the first URL', () => {
    const fp = postFingerprint('Week’s  “big”\nnews: see https://example.org/x and more');
    expect(fp).toBe('week\'s "big" news: see');
  });

  it('caps the length (default 80) so a truncated "…see more" list still matches', () => {
    expect(postFingerprint('a'.repeat(500)).length).toBe(80);
  });

  it('is empty for empty text — and an empty fingerprint never counts as a match', () => {
    expect(postFingerprint('   ')).toBe('');
    expect(countOnPage('anything at all', '')).toBe(0);
  });
});

describe('countOnPage', () => {
  it('finds the real captured LinkedIn list entry for the post that produced it', () => {
    expect(countOnPage(CAPTURED_LIST, postFingerprint(ORIGINAL_POST))).toBe(1);
  });

  it('counts each occurrence (morning and midday can open with the same line)', () => {
    const twice = `${CAPTURED_LIST}\n2d • \n${CAPTURED_LIST}`;
    expect(countOnPage(twice, postFingerprint(ORIGINAL_POST))).toBe(2);
  });

  it('does not match a different post', () => {
    expect(countOnPage(CAPTURED_LIST, postFingerprint('A completely different opening line for another week'))).toBe(0);
  });
});

describe('readListCount (the BEFORE read)', () => {
  it('loads the list, waits, and counts', async () => {
    const { page, calls } = fakeListPage([CAPTURED_LIST]);
    const r = await readListCount(page, LIST_URL, postFingerprint(ORIGINAL_POST), { settleMs: 10_000 });
    expect(r.count).toBe(1);
    expect(calls.goto).toEqual([LIST_URL]);
    expect(calls.waits[0]).toBeGreaterThanOrEqual(10_000);
  });

  it('a sign-in wall is unreadable (null), never a count of 0', async () => {
    const { page } = fakeListPage([CAPTURED_LIST], ['https://www.linkedin.com/authwall?x=1']);
    expect((await readListCount(page, LIST_URL, postFingerprint(ORIGINAL_POST))).count).toBeNull();
  });

  it('a read that throws is unreadable (null)', async () => {
    const { page } = fakeListPage([new Error('Target closed')]);
    expect((await readListCount(page, LIST_URL, postFingerprint(ORIGINAL_POST))).count).toBeNull();
  });
});

describe('waitUntilGone (do not leave while the composer is still sending)', () => {
  it('returns gone once the composer disappears', async () => {
    const { page, calls } = fakeListPage(['']);
    let polls = 0;
    const r = await waitUntilGone(page, async () => ++polls < 3, { timeoutMs: 30_000, pollMs: 2_000 });
    expect(r.gone).toBe(true);
    expect(calls.waits.length).toBe(3);
  });

  it('times out (not gone) when the composer never closes', async () => {
    const { page, calls } = fakeListPage(['']);
    const r = await waitUntilGone(page, async () => true, { timeoutMs: 10_000, pollMs: 2_000 });
    expect(r.gone).toBe(false);
    expect(calls.waits.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(10_000);
  });
});

describe('confirmNewPost (the AFTER read)', () => {
  const fp = () => postFingerprint(ORIGINAL_POST);

  it('verifies when the count rises above the before count, retrying while it has not', async () => {
    const { page } = fakeListPage(['nothing yet', CAPTURED_LIST]);
    const r = await confirmNewPost({ page, listUrl: LIST_URL, fingerprint: fp(), before: 0, log: () => {} });
    expect(r.verified).toBe(true);
    expect(r.checks).toBe(2);
  });

  it('is NOT verified when an earlier post with the same opening is all that is there', async () => {
    const { page } = fakeListPage([CAPTURED_LIST]);
    const r = await confirmNewPost({ page, listUrl: LIST_URL, fingerprint: fp(), before: 1, attempts: 3, log: () => {} });
    expect(r.verified).toBe(false);
    expect(r.checks).toBe(3);
  });

  it('a sign-in wall is never verified, even if the text is on the page', async () => {
    const { page } = fakeListPage([CAPTURED_LIST], ['https://www.linkedin.com/checkpoint/challenge']);
    const r = await confirmNewPost({ page, listUrl: LIST_URL, fingerprint: fp(), before: 0, attempts: 2, log: () => {} });
    expect(r.verified).toBe(false);
  });

  it('a read that throws is a failed check, retried — not a crash', async () => {
    const { page } = fakeListPage([new Error('net::ERR_ABORTED'), CAPTURED_LIST]);
    const r = await confirmNewPost({ page, listUrl: LIST_URL, fingerprint: fp(), before: 0, log: () => {} });
    expect(r.verified).toBe(true);
  });
});

describe('unverified results stop retries (a retry after a send can post twice)', () => {
  it('isUnverified recognises the prefix and nothing else', () => {
    expect(isUnverified(`${UNVERIFIED_PREFIX}: clicked Post but not seen`)).toBe(true);
    expect(isUnverified('Login error: bad password')).toBe(false);
    expect(isUnverified(undefined)).toBe(false);
  });
});

describe('list URLs', () => {
  it('builds the LinkedIn admin published list from the company id', () => {
    expect(linkedInListUrl('123')).toBe(LIST_URL);
  });

  it('builds the Threads profile from THREADS_PROFILE_URL, else from a handle, never from an email', () => {
    expect(threadsProfileUrl({ THREADS_PROFILE_URL: 'https://www.threads.net/@x' })).toBe('https://www.threads.net/@x');
    expect(threadsProfileUrl({ THREADS_USERNAME: 'distractionindex' })).toBe('https://www.threads.net/@distractionindex');
    expect(threadsProfileUrl({ THREADS_USERNAME: 'someone@example.com' })).toBeNull();
    expect(threadsProfileUrl({})).toBeNull();
  });
});

describe('wiring: every Playwright poster verifies before it reports success', () => {
  const read = (f: string) => readFileSync(resolve(__dirname, '../../scripts/outreach', f), 'utf8');
  const fnBody = (src: string, start: string, end: string) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start) + 1));
  const scheduler = read('scheduler.ts');

  it.each([
    ['scheduler.ts LinkedIn', fnBody(scheduler, 'async function postToLinkedInBrowser', 'function getCurrentSlot'), 'return { success: true }'],
    ['scheduler.ts Threads', fnBody(scheduler, 'async function postToThreadsSingleAttempt', 'async function postToThreadsBrowser'), 'return { success: true }'],
    ['linkedin-post.ts', read('linkedin-post.ts'), 'return true;'],
    ['threads-post.ts', fnBody(read('threads-post.ts'), 'async function postToThreadsSingleAttempt', 'async function postToThreads('), 'return { success: true }'],
  ])('%s reads the list BEFORE posting and confirms AFTER, before claiming success', (_name, body, successReturn) => {
    const before = body.indexOf('readListCount(');
    const click = body.lastIndexOf('.click()');
    const confirm = body.indexOf('confirmNewPost(');
    const success = body.lastIndexOf(successReturn);
    expect(before).toBeGreaterThan(-1);
    expect(confirm).toBeGreaterThan(-1);
    expect(before).toBeLessThan(click);
    expect(confirm).toBeGreaterThan(click);
    expect(success).toBeGreaterThan(confirm);
  });

  it.each([
    ['scheduler.ts', fnBody(scheduler, 'async function postToThreadsBrowser', 'async function postToLinkedInBrowser')],
    ['threads-post.ts', fnBody(read('threads-post.ts'), 'async function postToThreads(', 'async function main')],
  ])('%s Threads retry loop stops on an unverified post', (_name, body) => {
    expect(body).toContain('isUnverified(');
  });

  it('scheduler gives LinkedIn more than 60 s, so verification does not turn a real post into a "timed out" failure', () => {
    const m = /LINKEDIN_TIMEOUT_MS\s*=\s*([\d_]+)/.exec(scheduler);
    expect(m).not.toBeNull();
    expect(Number(m![1].replace(/_/g, ''))).toBeGreaterThanOrEqual(150_000);
    expect(fnBody(scheduler, 'async function executePost', 'async function runSchedulerLoop')).toContain('LINKEDIN_TIMEOUT_MS');
  });
});
