import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  titleOnPage,
  verifyPublished,
  writeHeartbeat,
  confirmPublishAndHeartbeat,
  PUBLISHED_DASHBOARD_URL,
  type DashboardPage,
  type GhResult,
} from '../../scripts/outreach/substack-verify';

const TITLE = 'Week 93: The Mail-In Voting Bombshell Buried Under Mosquito Control Theater';
const NOW = new Date('2026-10-11T09:04:00Z');

/** A fake Playwright page: each innerText('body') call returns the next entry (an Error is thrown). */
function fakePage(bodies: (string | Error)[], url = PUBLISHED_DASHBOARD_URL) {
  const calls = { goto: [] as string[], waits: [] as number[], reads: 0 };
  const page: DashboardPage = {
    goto: async (u: string) => {
      calls.goto.push(u);
      return null;
    },
    waitForTimeout: async (ms: number) => {
      calls.waits.push(ms);
    },
    url: () => url,
    innerText: async () => {
      const next = bodies[Math.min(calls.reads, bodies.length - 1)];
      calls.reads++;
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return { page, calls };
}

const ok = (stdout = ''): GhResult => ({ status: 0, stdout, stderr: '' });
// captured_from: defaultGhRunner(['variable','get','SUBSTACK_LAST_PUBLISHED_WEEK','-R','sgharlow/distraction'])
// on Steve's PC, gh 2.83.2, 2026-10-07 (variable not yet created) — status 1, message on stderr.
// The dashboard page texts below are GUESS shapes (the real Published list was not captured here);
// --verify-only is the live proof against the real page.
const notFound: GhResult = { status: 1, stdout: '', stderr: 'variable SUBSTACK_LAST_PUBLISHED_WEEK was not found\n' };

describe('titleOnPage', () => {
  it('finds the exact title in the Published list text', () => {
    expect(titleOnPage(`Published\n${TITLE}\nOct 11 · Sent to 412`, TITLE)).toBe(true);
  });

  it('ignores case, curly quotes, dashes and whitespace differences', () => {
    const t = "Week 94: Congress's 'Quiet' Deal - and Nobody Noticed";
    expect(titleOnPage('WEEK 94:  Congress’s ‘Quiet’ Deal — and   nobody noticed', t)).toBe(true);
  });

  it('accepts a title the dashboard truncated with an ellipsis', () => {
    expect(titleOnPage(`${TITLE.slice(0, 45)}…\nOct 11`, TITLE)).toBe(true);
  });

  it('does not match a different week or an empty page', () => {
    expect(titleOnPage('Week 92: The Mail-In Voting Bombshell Buried Under Mosquito Control Theater', TITLE)).toBe(false);
    expect(titleOnPage('', TITLE)).toBe(false);
  });

  it('never matches an empty title', () => {
    expect(titleOnPage('anything at all', '')).toBe(false);
  });
});

describe('verifyPublished', () => {
  it('verifies on the first check when the title is listed, after waiting at least 9 s', async () => {
    const { page, calls } = fakePage([`Published\n${TITLE}`]);
    const r = await verifyPublished(page, TITLE, { log: () => {} });
    expect(r.verified).toBe(true);
    expect(r.checks).toBe(1);
    expect(calls.goto).toEqual([PUBLISHED_DASHBOARD_URL]);
    expect(calls.waits[0]).toBeGreaterThanOrEqual(9_000);
  });

  it('retries when the list is still empty and verifies on a later check', async () => {
    const { page, calls } = fakePage(['Published\nNo posts', 'Published\nNo posts', `Published\n${TITLE}`]);
    const r = await verifyPublished(page, TITLE, { log: () => {} });
    expect(r.verified).toBe(true);
    expect(r.checks).toBe(3);
    expect(calls.goto).toHaveLength(3);
  });

  it('fails after every check misses, spanning about two minutes of waits', async () => {
    const { page, calls } = fakePage(['Published\nWeek 92: older post']);
    const r = await verifyPublished(page, TITLE, { log: () => {} });
    expect(r.verified).toBe(false);
    expect(r.checks).toBeGreaterThanOrEqual(3);
    const waited = calls.waits.reduce((a, b) => a + b, 0);
    expect(waited).toBeGreaterThanOrEqual(90_000);
    expect(waited).toBeLessThanOrEqual(240_000);
    expect(r.reason).toMatch(/not (found|listed)/i);
  });

  it('a page read that throws is a failed check, not a crash, and is retried', async () => {
    const { page } = fakePage([new Error('Target closed'), `Published\n${TITLE}`]);
    const r = await verifyPublished(page, TITLE, { log: () => {} });
    expect(r.verified).toBe(true);
    expect(r.checks).toBe(2);
  });

  it('a redirect to sign-in is never verified, even if the title text is present', async () => {
    const { page } = fakePage([TITLE], 'https://substack.com/sign-in?redirect=%2Fpublish');
    const r = await verifyPublished(page, TITLE, { log: () => {} });
    expect(r.verified).toBe(false);
    expect(r.reason).toMatch(/sign-in/i);
  });
});

describe('writeHeartbeat', () => {
  it('sets the week and timestamp variables when none exists yet', () => {
    const run = vi.fn().mockReturnValueOnce(notFound).mockReturnValue(ok());
    const r = writeHeartbeat(93, NOW, run);
    expect(r.ok).toBe(true);
    expect(run.mock.calls.map((c) => c[0])).toEqual([
      ['variable', 'get', 'SUBSTACK_LAST_PUBLISHED_WEEK', '-R', 'sgharlow/distraction'],
      ['variable', 'set', 'SUBSTACK_LAST_PUBLISHED_WEEK', '--body', '93', '-R', 'sgharlow/distraction'],
      ['variable', 'set', 'SUBSTACK_LAST_PUBLISHED_AT', '--body', '2026-10-11T09:04:00.000Z', '-R', 'sgharlow/distraction'],
    ]);
  });

  it('raises an older heartbeat', () => {
    const run = vi.fn().mockReturnValueOnce(ok('92\n')).mockReturnValue(ok());
    expect(writeHeartbeat(93, NOW, run).ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('never lowers the heartbeat (a --week backfill of an old week)', () => {
    const run = vi.fn().mockReturnValueOnce(ok('93\n'));
    const r = writeHeartbeat(80, NOW, run);
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('a failed set is a heartbeat failure', () => {
    const run = vi.fn()
      .mockReturnValueOnce(notFound)
      .mockReturnValueOnce({ status: 1, stdout: '', stderr: 'HTTP 403: Resource not accessible' });
    const r = writeHeartbeat(93, NOW, run);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('403');
  });

  it('a gh that cannot start (not on PATH) is a heartbeat failure', () => {
    const run = vi.fn().mockReturnValue({ status: null, stdout: '', stderr: '', error: new Error('spawnSync gh ENOENT') });
    const r = writeHeartbeat(93, NOW, run);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('ENOENT');
  });

  it('an unreadable current value for any reason other than not-found is a failure (fail closed)', () => {
    const run = vi.fn().mockReturnValueOnce({ status: 1, stdout: '', stderr: 'gh auth login required' });
    expect(writeHeartbeat(93, NOW, run).ok).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('refuses a non-integer week without calling gh', () => {
    const run = vi.fn();
    expect(writeHeartbeat(Number.NaN, NOW, run).ok).toBe(false);
    expect(writeHeartbeat(0, NOW, run).ok).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('confirmPublishAndHeartbeat (what substack-publish.ts runs after the send click)', () => {
  it('verification fails → no SUCCESS line, no heartbeat, a failure that warns against re-publishing', async () => {
    const { page } = fakePage(['Published\nWeek 92: older post']);
    const log = vi.fn();
    const heartbeat = vi.fn();
    const failures = await confirmPublishAndHeartbeat({ page, title: TITLE, week: 93, log, heartbeat });
    expect(heartbeat).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join('\n')).not.toMatch(/SUCCESS/);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/not verified|not found/i);
    expect(failures[0]).toMatch(/duplicate/i);
  });

  it('verified + heartbeat written → SUCCESS and no failures', async () => {
    const { page } = fakePage([`Published\n${TITLE}`]);
    const log = vi.fn();
    const heartbeat = vi.fn().mockReturnValue({ ok: true, message: 'heartbeat Week 93' });
    const failures = await confirmPublishAndHeartbeat({ page, title: TITLE, week: 93, log, heartbeat });
    expect(failures).toEqual([]);
    expect(heartbeat).toHaveBeenCalledWith(93);
    expect(log.mock.calls.flat().join('\n')).toMatch(/SUCCESS/);
  });

  it('verified but heartbeat failed → run fails, says the post DID go out, no SUCCESS line', async () => {
    const { page } = fakePage([`Published\n${TITLE}`]);
    const log = vi.fn();
    const heartbeat = vi.fn().mockReturnValue({ ok: false, message: 'gh variable set failed: HTTP 401' });
    const failures = await confirmPublishAndHeartbeat({ page, title: TITLE, week: 93, log, heartbeat });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/heartbeat/i);
    expect(failures[0]).toMatch(/did go out|was published/i);
    expect(failures[0]).toContain('HTTP 401');
    expect(log.mock.calls.flat().join('\n')).not.toMatch(/SUCCESS/);
  });

  it('verified but the post has no week number → run fails, no heartbeat', async () => {
    const { page } = fakePage([`Published\n${TITLE}`]);
    const heartbeat = vi.fn();
    const failures = await confirmPublishAndHeartbeat({ page, title: TITLE, week: null, log: () => {}, heartbeat });
    expect(heartbeat).not.toHaveBeenCalled();
    expect(failures).toHaveLength(1);
  });
});

describe('substack-publish.ts wiring', () => {
  const src = readFileSync(resolve(__dirname, '../../scripts/outreach/substack-publish.ts'), 'utf8');

  it('routes the post-send step through confirmPublishAndHeartbeat', () => {
    expect(src).toContain('confirmPublishAndHeartbeat(');
  });

  it('prints no SUCCESS line of its own (only the verified helper may)', () => {
    expect(src).not.toMatch(/SUCCESS/);
  });
});
