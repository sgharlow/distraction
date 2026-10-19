/**
 * Post-send verification + heartbeat for scripts/outreach/substack-publish.ts.
 *
 * WHY (2026-10-07). substack-publish.ts used to print "SUCCESS" straight after
 * clicking "Send to everyone" without checking anything, and the cloud dead-man
 * cannot read Substack (HTTP 403 to GitHub-hosted runners). So the publish run
 * now (1) proves the post is on the logged-in dashboard's Published list —
 * Substack's public archive lags 15+ min and is not a verifier; the dashboard
 * listed titles reliably after ~9 s, a 5 s wait read an empty list — and only
 * then (2) writes a heartbeat to the GitHub Actions repository variable
 * SUBSTACK_LAST_PUBLISHED_WEEK via the gh CLI. .github/workflows/substack-deadman.yml
 * reads that variable on Monday; no heartbeat = alert.
 *
 * Nothing here publishes. The page is injected (a Playwright Page satisfies
 * DashboardPage) and so is the gh runner, so the logic is unit-tested.
 */
import { spawnSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

export const PUBLISHED_DASHBOARD_URL = 'https://distractionindex.substack.com/publish/posts/published';
export const HEARTBEAT_WEEK_VAR = 'SUBSTACK_LAST_PUBLISHED_WEEK';
export const HEARTBEAT_AT_VAR = 'SUBSTACK_LAST_PUBLISHED_AT';
export const HEARTBEAT_REPO = 'sgharlow/distraction';

/** The subset of a Playwright Page the verifier uses. */
export interface DashboardPage {
  goto(url: string, opts?: { waitUntil?: 'domcontentloaded'; timeout?: number }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  url(): string;
  innerText(selector: string): Promise<string>;
}

export interface VerifyOptions {
  /** Dashboard loads to try (default 5). */
  attempts?: number;
  /** Wait after each load before reading (default 10 s; 5 s measured too short). */
  settleMs?: number;
  /** Extra wait between failed checks (default 20 s → ~2 min in total). */
  retryGapMs?: number;
  log?: (m: string) => void;
}

export interface VerifyResult {
  verified: boolean;
  /** How many dashboard loads were made. */
  checks: number;
  reason: string;
}

export interface GhResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}
export type GhRunner = (args: string[]) => GhResult;

export interface HeartbeatResult {
  ok: boolean;
  /** True when the stored heartbeat was already at or past this week. */
  skipped?: boolean;
  message: string;
}

const ELLIPSIS = '…';
/** Shortest visible prefix accepted when the dashboard truncates a title. */
const MIN_TRUNCATED_PREFIX = 30;

function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\.\.\./g, ELLIPSIS)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Is `title` on the page text? Exact match after normalising case, quotes,
 * dashes and whitespace — or a visible prefix of at least 30 characters that
 * the dashboard cut off with an ellipsis.
 */
export function titleOnPage(text: string, title: string): boolean {
  const t = normalize(title);
  if (!t) return false;
  const body = normalize(text);
  if (body.includes(t)) return true;
  if (!body.includes(ELLIPSIS)) return false;
  for (let k = t.length - 1; k >= MIN_TRUNCATED_PREFIX; k--) {
    const prefix = t.slice(0, k);
    if (body.includes(prefix + ELLIPSIS) || body.includes(prefix.trimEnd() + ELLIPSIS)) return true;
  }
  return false;
}

/**
 * Load the dashboard Published list in the publish run's own logged-in context
 * and look for the title; retry over ~2 minutes. A read that throws, or a
 * redirect to sign-in, is a failed check — never a pass.
 */
export async function verifyPublished(page: DashboardPage, title: string, opts: VerifyOptions = {}): Promise<VerifyResult> {
  const attempts = opts.attempts ?? 5;
  const settleMs = opts.settleMs ?? 10_000;
  const retryGapMs = opts.retryGapMs ?? 20_000;
  const log = opts.log ?? console.log;
  let reason = 'no check ran';
  for (let i = 1; i <= attempts; i++) {
    try {
      await page.goto(PUBLISHED_DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(settleMs);
      const url = page.url();
      if (/sign-in|login/i.test(url)) {
        reason = `dashboard redirected to sign-in (${url})`;
      } else {
        const text = await page.innerText('body');
        if (titleOnPage(text, title)) {
          return { verified: true, checks: i, reason: `title listed on the Published dashboard (check ${i}/${attempts})` };
        }
        reason = `title not found on the Published dashboard (${text.length} chars read)`;
      }
    } catch (e) {
      reason = `dashboard read failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 150)}`;
    }
    log(`  verify check ${i}/${attempts}: ${reason}`);
    if (i < attempts) await page.waitForTimeout(retryGapMs);
  }
  return { verified: false, checks: attempts, reason };
}

/** The subset of a Playwright Page the publish watcher uses. */
export interface PublishWatchPage {
  waitForTimeout(ms: number): Promise<void>;
  url(): string;
}

export interface PublishWaitResult {
  done: boolean;
  waitedMs: number;
  url: string;
  reason: string;
}

/** Where Substack lands once a send has finished: /publish/posts/detail/<id>[/share-center]. */
const PUBLISHED_POST_PAGE = /\/publish\/posts\/detail\/\d+/;

/**
 * Wait on the editor until Substack has actually finished publishing.
 *
 * WHY (2026-10-11). After "Send to everyone now" the editor shows "Publishing..." for ~45 s and
 * only then moves to /publish/posts/detail/<id>/share-center. Done means the post page loaded; a
 * page still on the editor at the timeout, or a redirect to sign-in, is a failure. Never navigate
 * the page while this is waiting.
 *
 * CORRECTION (2026-10-18). This was written on the belief that leaving the page early left Week 93
 * a DRAFT. It did not: the dashboard shows Week 93 published on Oct 11, and `--verify-only` found it
 * on the first check on 10-18. The 10-11 failure was the VERIFIER (it read 515 chars of a dashboard
 * that had not rendered its list). Week 94 (10-18) then sat on the editor for the full 240 s and
 * really stayed a draft, cause unknown — hence captureFailure below.
 */
export async function waitForPublishComplete(
  page: PublishWatchPage,
  opts: { timeoutMs?: number; pollMs?: number; log?: (m: string) => void } = {},
): Promise<PublishWaitResult> {
  const timeoutMs = opts.timeoutMs ?? 240_000;
  const pollMs = opts.pollMs ?? 5_000;
  const log = opts.log ?? console.log;
  let waitedMs = 0;
  let url = page.url();
  while (waitedMs < timeoutMs) {
    await page.waitForTimeout(pollMs);
    waitedMs += pollMs;
    url = page.url();
    if (PUBLISHED_POST_PAGE.test(url)) {
      return { done: true, waitedMs, url, reason: `publish finished after ~${Math.round(waitedMs / 1000)} s (${url})` };
    }
    if (/sign-in|login/i.test(url)) {
      return { done: false, waitedMs, url, reason: `redirected to sign-in while publishing (${url})` };
    }
    if (waitedMs % 30_000 === 0) log(`  still publishing after ${waitedMs / 1000} s...`);
  }
  return {
    done: false,
    waitedMs,
    url,
    reason: `still on the editor after ${Math.round(waitedMs / 1000)} s (${url}); Substack did not finish publishing`,
  };
}

/** The subset of a Playwright Page the failure capture uses. */
export interface CapturePage {
  url(): string;
  screenshot(opts: { path: string; fullPage?: boolean }): Promise<unknown>;
  locator(selector: string): { allInnerTexts(): Promise<string[]> };
}

/**
 * Record what the page looked like when a publish run failed: a full-page screenshot in `dir`
 * plus the URL and the text of any open dialog. WHY (2026-10-18): Week 94 sat on the editor for
 * 240 s and the run left nothing to diagnose it with. Never throws — a capture problem is
 * reported in the returned lines so it cannot mask the failure being recorded.
 */
export async function captureFailure(page: CapturePage, label: string, dir: string, now: Date = new Date()): Promise<string[]> {
  const lines: string[] = [];
  let url = '(unknown)';
  try {
    url = page.url();
  } catch {
    /* keep (unknown) */
  }
  lines.push(`url: ${url}`);
  try {
    const dialogs = (await page.locator('[role="dialog"], [role="alertdialog"]').allInnerTexts())
      .map((t) => t.split('\n').map((s) => s.trim()).filter(Boolean).join(' | '))
      .filter(Boolean);
    lines.push(dialogs.length ? dialogs.map((d) => `dialog: ${d.slice(0, 300)}`).join('\n') : 'dialog: none open');
  } catch (e) {
    lines.push(`dialog read failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 150)}`);
  }
  try {
    mkdirSync(dir, { recursive: true });
    const stamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
    const path = join(dir, `substack-${label}-${stamp}.png`);
    await page.screenshot({ path, fullPage: true });
    lines.push(`screenshot: ${path}`);
  } catch (e) {
    lines.push(`screenshot failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 150)}`);
  }
  return lines;
}

function ghFailure(r: GhResult): string {
  if (r.error) return r.error.message;
  return `exit ${r.status}: ${(r.stderr || r.stdout).trim().slice(0, 200)}`;
}

/**
 * Record `week` as the last verified publish. Never lowers a stored heartbeat
 * (a --week backfill of an old week must not make the Monday check alert).
 * Any gh failure — including one that is not "variable not found" while reading
 * the current value — returns ok:false (fail closed).
 */
export function writeHeartbeat(week: number, now: Date, run: GhRunner = defaultGhRunner): HeartbeatResult {
  if (!Number.isInteger(week) || week < 1) {
    return { ok: false, message: `refusing to write heartbeat: week "${week}" is not a positive integer` };
  }
  const current = run(['variable', 'get', HEARTBEAT_WEEK_VAR, '-R', HEARTBEAT_REPO]);
  if (current.status === 0) {
    const stored = current.stdout.trim();
    if (/^\d+$/.test(stored) && Number(stored) >= week) {
      return { ok: true, skipped: true, message: `heartbeat already at Week ${stored}; not lowering it to Week ${week}` };
    }
  } else if (current.error || !/not found/i.test(`${current.stderr}${current.stdout}`)) {
    return { ok: false, message: `could not read the current heartbeat (gh variable get): ${ghFailure(current)}` };
  }
  const setWeek = run(['variable', 'set', HEARTBEAT_WEEK_VAR, '--body', String(week), '-R', HEARTBEAT_REPO]);
  if (setWeek.status !== 0 || setWeek.error) {
    return { ok: false, message: `gh variable set ${HEARTBEAT_WEEK_VAR} failed: ${ghFailure(setWeek)}` };
  }
  const setAt = run(['variable', 'set', HEARTBEAT_AT_VAR, '--body', now.toISOString(), '-R', HEARTBEAT_REPO]);
  if (setAt.status !== 0 || setAt.error) {
    return {
      ok: false,
      message: `${HEARTBEAT_WEEK_VAR}=${week} was written but gh variable set ${HEARTBEAT_AT_VAR} failed: ${ghFailure(setAt)}`,
    };
  }
  return { ok: true, message: `heartbeat ${HEARTBEAT_WEEK_VAR}=${week} written at ${now.toISOString()}` };
}

export const defaultGhRunner: GhRunner = (args) => {
  const r = spawnSync('gh', args, { encoding: 'utf8', timeout: 60_000, windowsHide: true });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error };
};

/**
 * Everything substack-publish.ts does after the "Send to everyone" click.
 * Returns the run's failures ([] = success). SUCCESS is printed only when the
 * post was seen on the dashboard AND the heartbeat was written.
 */
export async function confirmPublishAndHeartbeat(args: {
  page: DashboardPage;
  title: string;
  week: number | null;
  log: (m: string) => void;
  heartbeat: (week: number) => HeartbeatResult;
  verifyOptions?: VerifyOptions;
}): Promise<string[]> {
  const { page, title, week, log, heartbeat } = args;
  const v = await verifyPublished(page, title, { log, ...args.verifyOptions });
  if (!v.verified) {
    log(`  NOT VERIFIED — "${title}" was not seen on the Published dashboard after ${v.checks} checks. No heartbeat written.`);
    return [
      `send clicked but the post was not verified on ${PUBLISHED_DASHBOARD_URL} after ${v.checks} checks (${v.reason}); ` +
        'no heartbeat written. Look at that page before re-publishing anything — a duplicate emails every subscriber.',
    ];
  }
  log(`  VERIFIED — ${v.reason}`);
  if (week === null) {
    log('  PUBLISHED (verified) but the post has no week number — heartbeat NOT written.');
    return ['post was published and verified, but it has no week_id, so no heartbeat was written; the Monday dead-man will alert — do NOT re-publish'];
  }
  const hb = heartbeat(week);
  if (!hb.ok) {
    log(`  PUBLISHED (verified) but HEARTBEAT FAILED — ${hb.message}`);
    return [
      `Week ${week} was published and verified (the post did go out — do NOT re-publish), but the heartbeat failed: ${hb.message}. ` +
        `The Monday dead-man will alert; fix with: gh variable set ${HEARTBEAT_WEEK_VAR} --body ${week} -R ${HEARTBEAT_REPO}`,
    ];
  }
  log(`  ${hb.message}`);
  log(`  SUCCESS — Week ${week} published to Substack, verified on the dashboard, heartbeat written.`);
  return [];
}
