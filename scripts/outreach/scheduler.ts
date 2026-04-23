/**
 * Automated 3x/day social media scheduler.
 * Posts to Bluesky + Mastodon + Threads + LinkedIn + Twitter/X at random times within 3 daily windows.
 *
 * Windows (EST):
 *   Morning:  6:00 AM - 8:00 AM
 *   Midday:  12:00 PM - 2:00 PM
 *   Evening:  5:00 PM - 8:00 PM
 *
 * Usage:
 *   npx tsx scripts/outreach/scheduler.ts           # Run scheduler (stays alive)
 *   npx tsx scripts/outreach/scheduler.ts --once     # Post for current slot and exit
 *   npx tsx scripts/outreach/scheduler.ts --catchup  # Post all missed slots for today
 *   npx tsx scripts/outreach/scheduler.ts --status   # Show today's schedule
 *
 * Install as background service:
 *   npm run outreach:scheduler                       # Run in foreground
 *   pm2 start scripts/outreach/scheduler.ts --interpreter="npx tsx"  # PM2 daemon
 *
 * Or use Windows Task Scheduler (see README at bottom).
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { generatePost, type PostSlot } from './content-variants';
import { postToTwitter } from './twitter-post';

config({ path: resolve(__dirname, '../../.env.local') });

const SCHEDULE_FILE = resolve(__dirname, 'schedule-state.json');
const POST_HISTORY = resolve(__dirname, 'post-history.json');
const THREADS_SESSION_DIR = resolve(__dirname, '.threads-session');
const SCREENSHOT_DIR = resolve(__dirname, 'debug-screenshots');
const THREADS_MAX_RETRIES = 3;
const THREADS_RETRY_DELAY_MS = 5000;

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

interface ScheduleState {
  date: string;  // YYYY-MM-DD
  slots: {
    morning: { scheduledAt: string; posted: boolean; postTime?: string };
    midday: { scheduledAt: string; posted: boolean; postTime?: string };
    evening: { scheduledAt: string; posted: boolean; postTime?: string };
  };
}

interface PostRecord {
  date: string;
  slot: PostSlot;
  variant: string;
  bluesky: { success: boolean; error?: string };
  mastodon: { success: boolean; error?: string };
  threads: { success: boolean; error?: string };
  linkedin: { success: boolean; error?: string };
  twitter?: { success: boolean; error?: string };
  postedAt: string;
  charCount: number;
}

// Eastern timezone helpers (handles EST/EDT automatically)
function getESTDate(): string {
  const now = new Date();
  const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const year = est.getFullYear();
  const month = String(est.getMonth() + 1).padStart(2, '0');
  const day = String(est.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getESTHour(): number {
  const now = new Date();
  const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return est.getHours();
}

function getESTMinute(): number {
  const now = new Date();
  const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return est.getMinutes();
}

function randomMinuteInWindow(startHour: number, endHour: number): { hour: number; minute: number } {
  const totalMinutes = (endHour - startHour) * 60;
  const randomOffset = Math.floor(Math.random() * totalMinutes);
  return {
    hour: startHour + Math.floor(randomOffset / 60),
    minute: randomOffset % 60,
  };
}

function generateDailySchedule(date: string): ScheduleState {
  const morning = randomMinuteInWindow(6, 8);
  const midday = randomMinuteInWindow(12, 14);
  const evening = randomMinuteInWindow(17, 20);

  return {
    date,
    slots: {
      morning: {
        scheduledAt: `${String(morning.hour).padStart(2, '0')}:${String(morning.minute).padStart(2, '0')} EST`,
        posted: false,
      },
      midday: {
        scheduledAt: `${String(midday.hour).padStart(2, '0')}:${String(midday.minute).padStart(2, '0')} EST`,
        posted: false,
      },
      evening: {
        scheduledAt: `${String(evening.hour).padStart(2, '0')}:${String(evening.minute).padStart(2, '0')} EST`,
        posted: false,
      },
    },
  };
}

function loadSchedule(): ScheduleState | null {
  if (!existsSync(SCHEDULE_FILE)) return null;
  return JSON.parse(readFileSync(SCHEDULE_FILE, 'utf-8'));
}

function saveSchedule(state: ScheduleState): void {
  writeFileSync(SCHEDULE_FILE, JSON.stringify(state, null, 2));
}

function loadHistory(): PostRecord[] {
  if (!existsSync(POST_HISTORY)) return [];
  return JSON.parse(readFileSync(POST_HISTORY, 'utf-8'));
}

function appendHistory(record: PostRecord): void {
  const history = loadHistory();
  history.push(record);
  // Keep last 90 days (270 posts max)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const trimmed = history.filter(h => new Date(h.postedAt) > cutoff);
  writeFileSync(POST_HISTORY, JSON.stringify(trimmed, null, 2));
}

function updateLastHistoryRecord(
  slot: PostSlot,
  updates: { linkedin: { success: boolean; error?: string }; twitter: { success: boolean; error?: string } },
): void {
  const history = loadHistory();
  const today = getESTDate();
  // Find the most recent record for this slot+date (the one we just appended)
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].date === today && history[i].slot === slot) {
      history[i].linkedin = updates.linkedin;
      history[i].twitter = updates.twitter;
      writeFileSync(POST_HISTORY, JSON.stringify(history, null, 2));
      return;
    }
  }
}

async function postToBluesky(text: string): Promise<{ success: boolean; error?: string }> {
  try {
    const handle = process.env.BLUESKY_HANDLE;
    const password = process.env.BLUESKY_APP_PASSWORD;
    if (!handle || !password) return { success: false, error: 'Missing credentials' };

    // Create session and resolve PDS endpoint (Bluesky migrates users between PDS instances)
    const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: handle, password }),
    });
    if (!sessionRes.ok) return { success: false, error: `Auth failed: ${sessionRes.status}` };
    const session = await sessionRes.json();
    const pdsEndpoint = session.didDoc?.service?.find((s: any) => s.id === '#atproto_pds')?.serviceEndpoint || 'https://bsky.social';

    // Detect URLs for facets
    const facets: any[] = [];
    const urlRegex = /https?:\/\/[^\s)]+/g;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
      const byteStart = Buffer.byteLength(text.substring(0, match.index), 'utf8');
      const byteEnd = byteStart + Buffer.byteLength(match[0], 'utf8');
      facets.push({
        index: { byteStart, byteEnd },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: match[0] }],
      });
    }

    // Handle threading for long posts
    const chunks = text.length <= 290 ? [text] : splitText(text, 280);
    let parentRef: any = null;
    let rootRef: any = null;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks.length > 1 && i < chunks.length - 1 ? chunks[i] + ' (cont.)' : chunks[i];
      const chunkFacets: any[] = [];
      const chunkUrlRegex = /https?:\/\/[^\s)]+/g;
      let m;
      while ((m = chunkUrlRegex.exec(chunk)) !== null) {
        const bs = Buffer.byteLength(chunk.substring(0, m.index), 'utf8');
        const be = bs + Buffer.byteLength(m[0], 'utf8');
        chunkFacets.push({
          index: { byteStart: bs, byteEnd: be },
          features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }],
        });
      }

      const record: any = {
        $type: 'app.bsky.feed.post',
        text: chunk,
        createdAt: new Date().toISOString(),
        langs: ['en'],
      };
      if (chunkFacets.length > 0) record.facets = chunkFacets;
      if (parentRef) record.reply = { root: rootRef, parent: parentRef };

      const postRes = await fetch(`${pdsEndpoint}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({ repo: session.did, collection: 'app.bsky.feed.post', record }),
      });

      if (!postRes.ok) {
        const err = await postRes.text();
        return { success: false, error: `Post failed: ${postRes.status} ${err}` };
      }

      const result = await postRes.json();
      const ref = { uri: result.uri, cid: result.cid };
      if (!rootRef) rootRef = ref;
      parentRef = ref;
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function postToMastodon(text: string): Promise<{ success: boolean; error?: string }> {
  try {
    const instance = process.env.MASTODON_INSTANCE;
    const token = process.env.MASTODON_ACCESS_TOKEN;
    if (!instance || !token) return { success: false, error: 'Missing credentials' };

    // Add hashtags for Mastodon
    const mastodonText = text + '\n\n#DistractionIndex #Democracy #ConstitutionalRights #CivicTech';

    const res = await fetch(`${instance}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: mastodonText,
        visibility: 'public',
        language: 'en',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Post failed: ${res.status} ${err}` };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

function splitText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  const lines = text.split('\n');
  let current = '';
  for (const line of lines) {
    if (current.length + line.length + 1 > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function postToThreadsSingleAttempt(text: string, attempt: number): Promise<{ success: boolean; error?: string }> {
  const username = process.env.THREADS_USERNAME;
  const password = process.env.THREADS_PASSWORD;
  if (!username || !password) return { success: false, error: 'Missing THREADS_USERNAME or THREADS_PASSWORD' };

  const { chromium } = await import('playwright');
  const { rmSync } = await import('fs');

  // Clean corrupted session before retry — crashed Chromium leaves broken profile
  if (attempt > 1) {
    try {
      rmSync(THREADS_SESSION_DIR, { recursive: true, force: true });
    } catch {}
  }
  ensureDir(THREADS_SESSION_DIR);

  let context;
  try {
    context = await chromium.launchPersistentContext(THREADS_SESSION_DIR, {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
      ],
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      timeout: 30000,
    });
  } catch (launchErr: any) {
    // Nuke corrupted session for next attempt
    try { rmSync(THREADS_SESSION_DIR, { recursive: true, force: true }); } catch {}
    return { success: false, error: `Browser launch failed (attempt ${attempt}): ${launchErr.message.substring(0, 200)}` };
  }

  const page = context.pages()[0] || await context.newPage();

  try {
    console.log(`    [Threads attempt ${attempt}] Navigating...`);

    // Navigate to homepage first — if session is valid, Create button appears without login
    await page.goto('https://www.threads.net/', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(4000);

    // Check if already logged in via persistent session
    let createBtn = page.getByRole('link', { name: /create/i }).first();
    let loggedIn = await createBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!loggedIn) {
      createBtn = page.getByRole('button', { name: /create/i }).first();
      loggedIn = await createBtn.isVisible({ timeout: 2000 }).catch(() => false);
    }
    if (!loggedIn) {
      createBtn = page.locator('[aria-label="Create"], [aria-label="New thread"]').first();
      loggedIn = await createBtn.isVisible({ timeout: 2000 }).catch(() => false);
    }

    if (!loggedIn) {
      // Not logged in — navigate to login page
      console.log(`    [Threads attempt ${attempt}] Logging in...`);
      await page.goto('https://www.threads.net/login', {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      await page.waitForTimeout(3000);

      const usernameInput = page.getByRole('textbox', { name: /username|phone|email/i });
      await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
      await usernameInput.fill(username);

      const passwordInput = page.getByRole('textbox', { name: /password/i });
      await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
      await passwordInput.fill(password);

      const loginBtn = page.getByRole('button', { name: 'Log in', exact: true }).first();
      await loginBtn.waitFor({ state: 'visible', timeout: 10000 });
      await loginBtn.click();

      console.log(`    [Threads attempt ${attempt}] Waiting for login...`);
      await page.waitForTimeout(8000);

      // Check for login error
      const errorText = await page.locator('[role="alert"], [data-testid="login-error"]').textContent().catch(() => null);
      if (errorText) {
        return { success: false, error: `Login error: ${errorText}` };
      }
    }

    // Find Create button (may already be set from logged-in check above)
    console.log(`    [Threads attempt ${attempt}] Looking for Create button...`);

    // Re-check all selector variants with longer timeouts
    createBtn = page.getByRole('button', { name: /create/i }).first();
    let createVisible = await createBtn.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);

    if (!createVisible) {
      createBtn = page.getByRole('link', { name: /create/i }).first();
      createVisible = await createBtn.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    }

    if (!createVisible) {
      createBtn = page.locator('[aria-label="Create"], [aria-label="New thread"]').first();
      createVisible = await createBtn.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    }

    if (!createVisible) {
      ensureDir(SCREENSHOT_DIR);
      const screenshotPath = resolve(SCREENSHOT_DIR, `threads-no-create-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      return { success: false, error: `Create button not found (attempt ${attempt}). Screenshot: ${screenshotPath}` };
    }

    await createBtn.click();
    await page.waitForTimeout(2000);

    // Wait for composer with increased timeout
    const composer = page.locator('[contenteditable="true"], [role="textbox"]').first();
    await composer.waitFor({ state: 'visible', timeout: 20000 });

    // Fill text, with keyboard fallback
    await composer.click();
    await page.waitForTimeout(500);
    await composer.fill(text);
    await page.waitForTimeout(1000);

    const composerText = await composer.textContent().catch(() => '');
    if (!composerText || composerText.length < 10) {
      console.log(`    [Threads attempt ${attempt}] fill() may have failed, using keyboard.type()...`);
      await composer.click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(300);
      await page.keyboard.type(text, { delay: 3 });
      await page.waitForTimeout(1000);
    }

    // Click Post
    const postBtn = page.locator('div[role="button"]:has-text("Post")').last();
    await postBtn.waitFor({ state: 'visible', timeout: 10000 });
    await postBtn.click();
    await page.waitForTimeout(4000);

    return { success: true };
  } catch (err: any) {
    try {
      ensureDir(SCREENSHOT_DIR);
      const screenshotPath = resolve(SCREENSHOT_DIR, `threads-error-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch {
      // Screenshot failed — browser may have crashed
    }
    return { success: false, error: `Attempt ${attempt}: ${err.message.substring(0, 300)}` };
  } finally {
    try {
      await context.close();
    } catch {
      // Ignore close errors
    }
  }
}

async function postToThreadsBrowser(text: string): Promise<{ success: boolean; error?: string }> {
  const errors: string[] = [];

  for (let attempt = 1; attempt <= THREADS_MAX_RETRIES; attempt++) {
    if (attempt > 1) {
      console.log(`    [Threads] Retrying in ${THREADS_RETRY_DELAY_MS / 1000}s (attempt ${attempt}/${THREADS_MAX_RETRIES})...`);
      await new Promise(r => setTimeout(r, THREADS_RETRY_DELAY_MS));
    }

    const result = await postToThreadsSingleAttempt(text, attempt);
    if (result.success) {
      if (attempt > 1) {
        console.log(`    [Threads] Succeeded on attempt ${attempt}/${THREADS_MAX_RETRIES}`);
      }
      return { success: true };
    }

    errors.push(result.error || 'Unknown error');
    console.log(`    [Threads] Attempt ${attempt} failed: ${result.error?.substring(0, 150)}`);

    // Don't retry credential errors
    if (result.error?.includes('Missing THREADS_') || result.error?.includes('Login error')) {
      break;
    }
  }

  return { success: false, error: errors.join(' | ').substring(0, 500) };
}

async function postToLinkedInBrowser(text: string): Promise<{ success: boolean; error?: string }> {
  try {
    const companyId = process.env.LINKEDIN_COMPANY_ID;
    const email = process.env.LINKEDIN_EMAIL;
    if (!companyId || !email) return { success: false, error: 'Missing LINKEDIN_COMPANY_ID or LINKEDIN_EMAIL' };

    // LinkedIn blocks headless and fresh sessions aggressively.
    // Use a dedicated persistent Chrome profile that maintains LinkedIn login.
    // First run: use `npm run outreach:linkedin` to log in manually.
    // Subsequent runs reuse the saved session.
    const { chromium } = await import('playwright');
    const userDataDir = resolve(__dirname, '.linkedin-session');

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,  // LinkedIn detects and blocks headless
      timeout: 60000,
    });
    const page = context.pages()[0] || await context.newPage();

    try {
      const shareUrl = `https://www.linkedin.com/company/${companyId}/admin/page-posts/published?share=true&shareActorType=ORGANIZATION&shareOrganizationActor=urn%3Ali%3Afsd_company%3A${companyId}`;
      await page.goto(shareUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(5000);

      // Check if redirected to login/authwall
      const url = page.url();
      if (url.includes('/login') || url.includes('/authwall') || url.includes('/uas/')) {
        // Try logging in
        try {
          await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.waitForTimeout(2000);
          const emailInput = page.getByRole('textbox', { name: /email|phone/i });
          if (await emailInput.isVisible().catch(() => false)) {
            await emailInput.fill(email);
            await page.getByRole('textbox', { name: /password/i }).fill(process.env.LINKEDIN_PASSWORD || '');
            await page.getByRole('button', { name: /sign in/i }).click();
            await page.waitForTimeout(8000);
            // Check if we hit a challenge
            const challengeUrl = page.url();
            if (challengeUrl.includes('/checkpoint')) {
              return { success: false, error: 'LinkedIn app challenge — run npm run outreach:linkedin manually to approve on phone' };
            }
            // Retry navigation to company page
            await page.goto(shareUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(5000);
          }
        } catch {
          return { success: false, error: 'LinkedIn login failed' };
        }
      }

      // Wait for composer (share=true should open it)
      const editor = page.getByRole('textbox', { name: /text editor/i });
      const editorVisible = await editor.isVisible({ timeout: 10000 }).catch(() => false);

      if (!editorVisible) {
        const startPost = page.locator('button:has-text("Start a post")');
        const startVisible = await startPost.isVisible().catch(() => false);
        if (startVisible) {
          await startPost.click();
          await page.waitForTimeout(2000);
        } else {
          return { success: false, error: 'Could not find post composer on LinkedIn' };
        }
      }

      // Type using keyboard (fill() doesn't trigger LinkedIn content detection)
      const composer = page.getByRole('textbox', { name: /text editor/i });
      await composer.click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(300);

      const linkedInText = text + '\n\n#DistractionIndex #Democracy #CivicTech #ConstitutionalLaw #GovTech';
      await page.keyboard.type(linkedInText, { delay: 5 });
      await page.waitForTimeout(2000);

      // Click Post
      const postBtn = page.getByRole('button', { name: 'Post', exact: true });
      const postEnabled = await postBtn.isEnabled().catch(() => false);
      if (!postEnabled) {
        return { success: false, error: 'LinkedIn Post button not enabled after typing' };
      }
      await postBtn.click();
      await page.waitForTimeout(5000);

      // Dismiss success dialog
      const dismissBtn = page.getByRole('button', { name: 'Not now' });
      if (await dismissBtn.isVisible().catch(() => false)) {
        await dismissBtn.click();
      }

      return { success: true };
    } finally {
      await context.close();
    }
  } catch (e: any) {
    return { success: false, error: e.message.substring(0, 200) };
  }
}

function getCurrentSlot(): PostSlot | null {
  const hour = getESTHour();
  if (hour >= 6 && hour < 8) return 'morning';
  if (hour >= 12 && hour < 14) return 'midday';
  if (hour >= 17 && hour < 20) return 'evening';
  return null;
}

function isSlotDue(schedule: ScheduleState, slot: PostSlot): boolean {
  const slotState = schedule.slots[slot];
  if (slotState.posted) return false;

  const [schedHour, schedMin] = slotState.scheduledAt.replace(' EST', '').split(':').map(Number);
  const currentHour = getESTHour();
  const currentMin = getESTMinute();

  return (currentHour > schedHour) || (currentHour === schedHour && currentMin >= schedMin);
}

// Wrap a Playwright-based platform call with a hard timeout so it can't
// hang the entire pipeline (L240: per-platform timeouts are essential).
const PLAYWRIGHT_TIMEOUT_MS = 60_000; // 60 seconds max per Playwright platform

async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);
}

async function executePost(slot: PostSlot): Promise<void> {
  console.log(`\n[${new Date().toISOString()}] Generating ${slot} post...`);

  const post = await generatePost(slot);
  console.log(`  Variant: ${post.variant}`);
  console.log(`  Content (${post.text.length} chars):`);
  console.log(`  ${post.text.substring(0, 100)}...`);

  // --- Phase 1: API-based platforms (reliable, fast) ---
  console.log(`  Posting to Bluesky...`);
  const bsky = await postToBluesky(post.text);
  console.log(`  Bluesky: ${bsky.success ? 'SUCCESS' : 'FAILED: ' + bsky.error}`);

  console.log(`  Posting to Mastodon...`);
  const masto = await postToMastodon(post.text);
  console.log(`  Mastodon: ${masto.success ? 'SUCCESS' : 'FAILED: ' + masto.error}`);

  // Threads disabled — Meta UI changes cause Playwright timeouts that block
  // the entire posting pipeline and kill the Windows Task Scheduler job.
  // Re-enable when Threads stabilizes or an API becomes available.
  const threads = { success: false, error: 'Threads posting disabled (Meta UI instability)' };
  console.log(`  Threads: SKIPPED (disabled — Meta UI instability)`);

  // Save immediately after API platforms — guarantees Bluesky + Mastodon
  // posts are recorded even if Playwright platforms hang or crash below.
  const record: PostRecord = {
    date: getESTDate(),
    slot,
    variant: post.variant,
    bluesky: bsky,
    mastodon: masto,
    threads,
    linkedin: { success: false, error: 'pending' },
    twitter: { success: false, error: 'pending' },
    postedAt: new Date().toISOString(),
    charCount: post.text.length,
  };
  appendHistory(record);
  console.log(`  [Checkpoint] API platforms saved to post-history.json`);

  // --- Phase 2: Playwright-based platforms (may hang — 60s timeout each) ---
  let linkedin: { success: boolean; error?: string };
  console.log(`  Posting to LinkedIn (60s timeout)...`);
  try {
    linkedin = await withTimeout(
      () => postToLinkedInBrowser(post.text),
      PLAYWRIGHT_TIMEOUT_MS,
      'LinkedIn',
    );
  } catch (e: any) {
    linkedin = { success: false, error: e.message.substring(0, 200) };
  }
  console.log(`  LinkedIn: ${linkedin.success ? 'SUCCESS' : 'FAILED: ' + linkedin.error}`);

  let twitter: { success: boolean; error?: string };
  console.log(`  Posting to Twitter/X (60s timeout)...`);
  try {
    twitter = await withTimeout(
      () => postToTwitter(post.text),
      PLAYWRIGHT_TIMEOUT_MS,
      'Twitter/X',
    );
  } catch (e: any) {
    twitter = { success: false, error: e.message.substring(0, 200) };
  }
  console.log(`  Twitter/X: ${twitter.success ? 'SUCCESS' : 'FAILED: ' + twitter.error}`);

  // --- Update the saved record with Playwright platform results ---
  updateLastHistoryRecord(slot, { linkedin, twitter });

  const platforms = [bsky, masto, threads, linkedin, twitter];
  const succeeded = platforms.filter(p => p.success).length;
  console.log(`  Result: ${succeeded}/${platforms.length} platforms succeeded`);
}

async function runSchedulerLoop(): Promise<void> {
  console.log('=== Distraction Index Social Scheduler ===');
  console.log(`Started at ${new Date().toISOString()}`);
  console.log('Posting to: Bluesky + Mastodon + Threads + LinkedIn + Twitter/X');
  console.log('Schedule: 3x/day (morning 6-8am, midday 12-2pm, evening 5-8pm EST)\n');

  while (true) {
    const today = getESTDate();
    let schedule = loadSchedule();

    // Generate new daily schedule if needed
    if (!schedule || schedule.date !== today) {
      schedule = generateDailySchedule(today);
      saveSchedule(schedule);
      console.log(`\n[${today}] New daily schedule generated:`);
      console.log(`  Morning:  ${schedule.slots.morning.scheduledAt}`);
      console.log(`  Midday:   ${schedule.slots.midday.scheduledAt}`);
      console.log(`  Evening:  ${schedule.slots.evening.scheduledAt}`);
    }

    // Check each slot
    for (const slot of ['morning', 'midday', 'evening'] as PostSlot[]) {
      if (isSlotDue(schedule, slot)) {
        try {
          await executePost(slot);
          schedule.slots[slot].posted = true;
          schedule.slots[slot].postTime = new Date().toISOString();
          saveSchedule(schedule);
        } catch (err: any) {
          console.error(`  Error in ${slot} post:`, err.message);
        }
      }
    }

    // Sleep 60 seconds between checks
    await new Promise(r => setTimeout(r, 60_000));
  }
}

async function runOnce(): Promise<void> {
  const slot = getCurrentSlot();
  if (!slot) {
    const hour = getESTHour();
    console.log(`Current EST hour: ${hour}. No posting slot active right now.`);
    console.log('Slots: morning (6-8am), midday (12-2pm), evening (5-8pm) EST');
    console.log('\nForce a specific slot:');
    console.log('  npx tsx scripts/outreach/scheduler.ts --post morning');
    console.log('  npx tsx scripts/outreach/scheduler.ts --post midday');
    console.log('  npx tsx scripts/outreach/scheduler.ts --post evening');
    return;
  }

  const today = getESTDate();
  const history = loadHistory();
  const alreadyPosted = history.find(h => h.date === today && h.slot === slot);
  if (alreadyPosted) {
    console.log(`Already posted for ${slot} slot today (${today}).`);
    return;
  }

  await executePost(slot);
}

async function forcePost(slot: PostSlot, skipDedupCheck = false): Promise<void> {
  if (!skipDedupCheck) {
    const today = getESTDate();
    const history = loadHistory();
    const alreadyPosted = history.find(h => h.date === today && h.slot === slot);
    if (alreadyPosted) {
      console.log(`Already posted for ${slot} slot today (${today}). Use --force to override.`);
      return;
    }
  }
  console.log(`Force posting for ${slot} slot...`);
  await executePost(slot);

  // Update schedule state so --status reflects actual posts
  const today = getESTDate();
  let schedule = loadSchedule();
  if (!schedule || schedule.date !== today) {
    schedule = generateDailySchedule(today);
  }
  schedule.slots[slot].posted = true;
  schedule.slots[slot].postTime = new Date().toISOString();
  saveSchedule(schedule);
}

/**
 * Catch-up: post all un-posted slots for today that are at or before the current time window.
 * Called on PC wake/startup or manually via --catchup.
 */
async function catchupMissedSlots(): Promise<void> {
  const today = getESTDate();
  const hour = getESTHour();
  const history = loadHistory();
  const todayPosts = history.filter(h => h.date === today);
  const postedSlots = new Set(todayPosts.map(h => h.slot));

  // Determine which slots should have fired by now
  const slotWindows: Array<{ slot: PostSlot; endHour: number }> = [
    { slot: 'morning', endHour: 8 },
    { slot: 'midday', endHour: 14 },
    { slot: 'evening', endHour: 20 },
  ];

  const missedSlots = slotWindows
    .filter(sw => hour >= sw.endHour && !postedSlots.has(sw.slot))
    .map(sw => sw.slot);

  // Also include the current active slot if not posted
  const currentSlot = getCurrentSlot();
  if (currentSlot && !postedSlots.has(currentSlot) && !missedSlots.includes(currentSlot)) {
    missedSlots.push(currentSlot);
  }

  if (missedSlots.length === 0) {
    console.log(`No missed slots to catch up (${todayPosts.length} posts today).`);
    return;
  }

  console.log(`\n[Catch-up] ${missedSlots.length} missed slot(s) detected: ${missedSlots.join(', ')}`);

  for (const slot of missedSlots) {
    console.log(`\n[Catch-up] Posting ${slot}...`);
    try {
      await forcePost(slot, false);
    } catch (err: any) {
      console.error(`  [Catch-up] Error posting ${slot}:`, err.message);
    }
    // Brief pause between catch-up posts to avoid rate limits
    if (missedSlots.indexOf(slot) < missedSlots.length - 1) {
      console.log('  Waiting 15s before next catch-up post...');
      await new Promise(r => setTimeout(r, 15_000));
    }
  }

  console.log(`\n[Catch-up] Done. Posted ${missedSlots.length} catch-up slot(s).`);
}

function showStatus(): void {
  const today = getESTDate();
  const schedule = loadSchedule();
  const history = loadHistory();
  const todayPosts = history.filter(h => h.date === today);

  console.log(`\n=== Scheduler Status (${today}) ===\n`);
  console.log(`Current EST time: ${getESTHour()}:${String(getESTMinute()).padStart(2, '0')}`);
  console.log(`Current slot: ${getCurrentSlot() || 'none (between windows)'}\n`);

  if (schedule && schedule.date === today) {
    console.log('Today\'s schedule:');
    for (const slot of ['morning', 'midday', 'evening'] as PostSlot[]) {
      const s = schedule.slots[slot];
      const icon = s.posted ? 'POSTED' : 'PENDING';
      console.log(`  ${slot.padEnd(8)} ${s.scheduledAt.padEnd(12)} ${icon}`);
    }
  } else {
    console.log('No schedule for today yet (will generate on first run).');
  }

  console.log(`\nPosts today: ${todayPosts.length}`);
  for (const p of todayPosts) {
    console.log(`  ${p.slot} (${p.variant}) — Bsky: ${p.bluesky.success ? 'OK' : 'FAIL'}, Masto: ${p.mastodon.success ? 'OK' : 'FAIL'}, Threads: ${p.threads?.success ? 'OK' : 'FAIL'}, LI: ${p.linkedin?.success ? 'OK' : 'FAIL'}, X: ${p.twitter?.success ? 'OK' : 'N/A'}`);
  }

  const last7 = history.filter(h => {
    const d = new Date(h.postedAt);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return d > cutoff;
  });
  console.log(`\nPosts in last 7 days: ${last7.length}`);
  const successRate = last7.length > 0
    ? Math.round(last7.filter(h => h.bluesky.success && h.mastodon.success).length / last7.length * 100)
    : 0;
  console.log(`Success rate: ${successRate}%`);
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--status')) {
    showStatus();
  } else if (args.includes('--catchup')) {
    await catchupMissedSlots();
  } else if (args.includes('--once')) {
    await runOnce();
  } else if (args.includes('--post')) {
    const slot = args[args.indexOf('--post') + 1] as PostSlot;
    if (!['morning', 'midday', 'evening'].includes(slot)) {
      console.error('Usage: --post morning|midday|evening [--force]');
      process.exit(1);
    }
    const skipDedup = args.includes('--force');
    // Auto catch-up earlier missed slots before posting the requested one
    if (!args.includes('--no-catchup')) {
      const today = getESTDate();
      const history = loadHistory();
      const postedSlots = new Set(history.filter(h => h.date === today).map(h => h.slot));
      const slotOrder: PostSlot[] = ['morning', 'midday', 'evening'];
      const targetIdx = slotOrder.indexOf(slot);
      for (let i = 0; i < targetIdx; i++) {
        if (!postedSlots.has(slotOrder[i])) {
          console.log(`[Auto catch-up] Posting missed ${slotOrder[i]} slot first...`);
          try {
            await forcePost(slotOrder[i], false);
            console.log('  Waiting 15s before next post...');
            await new Promise(r => setTimeout(r, 15_000));
          } catch (err: any) {
            console.error(`  [Auto catch-up] Error: ${err.message}`);
          }
        }
      }
    }
    await forcePost(slot, skipDedup);
    process.exit(0);
  } else {
    await runSchedulerLoop();
    return;
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Scheduler error:', err.message);
  process.exit(1);
});
