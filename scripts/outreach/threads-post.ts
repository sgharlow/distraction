/**
 * Post to Threads via Playwright browser automation.
 * Threads API requires Meta app review which takes weeks,
 * so we use browser automation for now.
 *
 * Reliability improvements (2026-03-18):
 *   - Retry up to 3 times with 5-second delays between attempts
 *   - Use full Chromium (not headless shell) to avoid Windows crash (exitCode 3221225794)
 *   - Use 'domcontentloaded' instead of 'networkidle' (React SPA never truly idles)
 *   - Increased timeouts: 45s page load, 30s Create button, 20s composer
 *   - Save screenshot on failure for debugging
 *   - Persistent browser context to reuse login sessions
 *
 * Usage:
 *   npx tsx scripts/outreach/threads-post.ts [--dry-run] [--slot morning|midday|evening]
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { generatePost, type PostSlot } from './content-variants';

config({ path: resolve(__dirname, '../../.env.local') });

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const SESSION_DIR = resolve(__dirname, '.threads-session');
const SCREENSHOT_DIR = resolve(__dirname, 'debug-screenshots');

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function postToThreadsSingleAttempt(text: string, attempt: number): Promise<{ success: boolean; error?: string }> {
  const username = process.env.THREADS_USERNAME;
  const password = process.env.THREADS_PASSWORD;
  if (!username || !password) {
    return { success: false, error: 'Missing THREADS_USERNAME or THREADS_PASSWORD in .env.local' };
  }

  const { chromium } = await import('playwright');

  // Use persistent context to maintain login session across runs.
  // Use full Chromium (headless: true with channel) instead of headless shell
  // to avoid Windows crash exitCode 3221225794.
  ensureDir(SESSION_DIR);

  let context;
  try {
    context = await chromium.launchPersistentContext(SESSION_DIR, {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
      ],
      timeout: 30000,
    });
  } catch (launchErr: any) {
    return { success: false, error: `Browser launch failed (attempt ${attempt}): ${launchErr.message.substring(0, 200)}` };
  }

  const page = context.pages()[0] || await context.newPage();

  try {
    console.log(`  [Threads attempt ${attempt}] Navigating to Threads...`);

    // Use domcontentloaded instead of networkidle — Threads is a React SPA
    // that keeps WebSocket connections open, so networkidle often times out.
    await page.goto('https://www.threads.net/login', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(3000);

    // Check if already logged in (persistent session) by looking for Create button
    const createBtnEarly = page.getByRole('link', { name: /create/i }).first();
    const alreadyLoggedIn = await createBtnEarly.isVisible({ timeout: 3000 }).catch(() => false);

    if (!alreadyLoggedIn) {
      // Also check for a button variant of Create
      const createBtnAlt = page.getByRole('button', { name: /create/i }).first();
      const altLoggedIn = await createBtnAlt.isVisible({ timeout: 2000 }).catch(() => false);

      if (!altLoggedIn) {
        console.log(`  [Threads attempt ${attempt}] Not logged in, filling login form...`);

        // Wait for login form to appear
        const usernameInput = page.getByRole('textbox', { name: /username|phone|email/i });
        await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
        await usernameInput.fill(username);

        const passwordInput = page.getByRole('textbox', { name: /password/i });
        await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
        await passwordInput.fill(password);

        // Click Log in — use exact match to avoid Instagram SSO button
        const loginBtn = page.getByRole('button', { name: 'Log in', exact: true }).first();
        await loginBtn.waitFor({ state: 'visible', timeout: 10000 });
        await loginBtn.click();

        // Wait for login to complete (page navigates)
        console.log(`  [Threads attempt ${attempt}] Waiting for login to complete...`);
        await page.waitForTimeout(6000);

        // Check for login error (wrong password, account locked, etc.)
        const errorText = await page.locator('[role="alert"], [data-testid="login-error"]').textContent().catch(() => null);
        if (errorText) {
          return { success: false, error: `Login error: ${errorText}` };
        }
      }
    }

    // Wait for Create button with increased timeout (30s)
    console.log(`  [Threads attempt ${attempt}] Looking for Create button...`);

    // Threads uses different element types for Create — try multiple selectors
    let createBtn = page.getByRole('button', { name: /create/i }).first();
    let createVisible = await createBtn.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);

    if (!createVisible) {
      // Try link variant
      createBtn = page.getByRole('link', { name: /create/i }).first();
      createVisible = await createBtn.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    }

    if (!createVisible) {
      // Try aria-label or SVG-based Create icon (Threads sometimes uses an icon without text)
      createBtn = page.locator('[aria-label="Create"], [aria-label="New thread"]').first();
      createVisible = await createBtn.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    }

    if (!createVisible) {
      ensureDir(SCREENSHOT_DIR);
      const screenshotPath = resolve(SCREENSHOT_DIR, `threads-no-create-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  [Threads attempt ${attempt}] Screenshot saved: ${screenshotPath}`);
      return { success: false, error: `Create button not found after login (attempt ${attempt}). Screenshot saved.` };
    }

    // Click Create to open post composer
    await createBtn.click();
    await page.waitForTimeout(2000);

    // Wait for composer with increased timeout (20s)
    console.log(`  [Threads attempt ${attempt}] Waiting for composer...`);
    const composer = page.locator('[contenteditable="true"], [role="textbox"]').first();
    await composer.waitFor({ state: 'visible', timeout: 20000 });

    // Use keyboard typing instead of fill() for better reliability with contenteditable
    await composer.click();
    await page.waitForTimeout(500);
    await composer.fill(text);
    await page.waitForTimeout(1000);

    // Verify text was entered
    const composerText = await composer.textContent().catch(() => '');
    if (!composerText || composerText.length < 10) {
      // Fallback: try typing character by character
      console.log(`  [Threads attempt ${attempt}] fill() may have failed, trying keyboard.type()...`);
      await composer.click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(300);
      await page.keyboard.type(text, { delay: 3 });
      await page.waitForTimeout(1000);
    }

    // Click Post button
    console.log(`  [Threads attempt ${attempt}] Clicking Post...`);
    const postBtn = page.locator('div[role="button"]:has-text("Post")').last();
    await postBtn.waitFor({ state: 'visible', timeout: 10000 });
    await postBtn.click();
    await page.waitForTimeout(4000);

    console.log(`  [Threads attempt ${attempt}] Posted successfully`);
    return { success: true };
  } catch (err: any) {
    // Save screenshot on failure for debugging
    try {
      ensureDir(SCREENSHOT_DIR);
      const screenshotPath = resolve(SCREENSHOT_DIR, `threads-error-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  [Threads attempt ${attempt}] Error screenshot saved: ${screenshotPath}`);
    } catch {
      // Screenshot failed too — browser may be crashed
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

async function postToThreads(text: string, dryRun: boolean): Promise<boolean> {
  if (dryRun) {
    console.log('[DRY RUN] Would post to Threads:');
    console.log(text);
    return true;
  }

  const errors: string[] = [];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 1) {
      console.log(`  [Threads] Retrying in ${RETRY_DELAY_MS / 1000}s (attempt ${attempt}/${MAX_RETRIES})...`);
      await sleep(RETRY_DELAY_MS);
    }

    const result = await postToThreadsSingleAttempt(text, attempt);
    if (result.success) {
      if (attempt > 1) {
        console.log(`  [Threads] Succeeded on attempt ${attempt}/${MAX_RETRIES}`);
      }
      return true;
    }

    errors.push(result.error || 'Unknown error');
    console.log(`  [Threads] Attempt ${attempt} failed: ${result.error?.substring(0, 150)}`);

    // Don't retry on credential errors — they won't fix themselves
    if (result.error?.includes('Missing THREADS_') || result.error?.includes('Login error')) {
      console.log('  [Threads] Non-retryable error, giving up.');
      break;
    }
  }

  console.error(`  [Threads] All ${MAX_RETRIES} attempts failed. Errors: ${errors.join(' | ').substring(0, 500)}`);
  return false;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const slotArg = process.argv.find(a => a.startsWith('--slot='));
  const slot = (slotArg?.split('=')[1] || 'midday') as PostSlot;

  console.log('Generating post content...');
  const post = await generatePost(slot);

  console.log(`\n--- Threads post (${post.variant}) ---`);
  console.log(post.text);
  console.log(`--- ${post.text.length} chars ---\n`);

  const ok = await postToThreads(post.text, dryRun);
  if (!ok) process.exit(1);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
