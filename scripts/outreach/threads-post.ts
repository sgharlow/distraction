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
  const { rmSync } = await import('fs');

  // Clean corrupted session before retry — crashed Chromium leaves broken profile
  if (attempt > 1) {
    try { rmSync(SESSION_DIR, { recursive: true, force: true }); } catch {}
  }
  ensureDir(SESSION_DIR);

  let context;
  try {
    context = await chromium.launchPersistentContext(SESSION_DIR, {
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
    try { rmSync(SESSION_DIR, { recursive: true, force: true }); } catch {}
    return { success: false, error: `Browser launch failed (attempt ${attempt}): ${launchErr.message.substring(0, 200)}` };
  }

  const page = context.pages()[0] || await context.newPage();

  try {
    console.log(`  [Threads attempt ${attempt}] Navigating to Threads...`);

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
      console.log(`  [Threads attempt ${attempt}] Not logged in, navigating to login...`);
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

      console.log(`  [Threads attempt ${attempt}] Waiting for login to complete...`);
      await page.waitForTimeout(8000);

      const errorText = await page.locator('[role="alert"], [data-testid="login-error"]').textContent().catch(() => null);
      if (errorText) {
        return { success: false, error: `Login error: ${errorText}` };
      }
    }

    // Find Create button with broader selectors
    console.log(`  [Threads attempt ${attempt}] Looking for Create button...`);

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
      console.log(`  [Threads attempt ${attempt}] Screenshot saved: ${screenshotPath}`);
      return { success: false, error: `Create button not found after login (attempt ${attempt}). Screenshot saved.` };
    }

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
