/**
 * Post to Threads via Playwright browser automation.
 * Threads API requires Meta app review which takes weeks,
 * so we use browser automation for now.
 *
 * Usage:
 *   npx tsx scripts/outreach/threads-post.ts [--dry-run] [--slot morning|midday|evening]
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { generatePost, type PostSlot } from './content-variants';

config({ path: resolve(__dirname, '../../.env.local') });

async function postToThreads(text: string, dryRun: boolean): Promise<boolean> {
  if (dryRun) {
    console.log('[DRY RUN] Would post to Threads:');
    console.log(text);
    return true;
  }

  const username = process.env.THREADS_USERNAME;
  const password = process.env.THREADS_PASSWORD;
  if (!username || !password) {
    console.error('Missing THREADS_USERNAME or THREADS_PASSWORD in .env.local');
    return false;
  }

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Go to Threads login
    await page.goto('https://www.threads.com/login?show_choice_screen=false', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // Fill login form
    const usernameInput = page.getByRole('textbox', { name: /username|phone|email/i });
    await usernameInput.fill(username);

    const passwordInput = page.getByRole('textbox', { name: /password/i });
    await passwordInput.fill(password);

    // Use exact match to avoid hitting the Instagram SSO button
    await page.getByRole('button', { name: 'Log in', exact: true }).first().click();
    await page.waitForTimeout(5000);

    // Check if logged in by looking for Create button
    const createBtn = page.getByRole('button', { name: 'Create' }).first();
    await createBtn.waitFor({ state: 'visible', timeout: 15000 });

    // Click Create to open post composer
    await createBtn.click();
    await page.waitForTimeout(2000);

    // The composer may be a contenteditable div, not a textbox
    const composer = page.locator('[contenteditable="true"], [role="textbox"]').first();
    await composer.waitFor({ state: 'visible', timeout: 10000 });
    await composer.fill(text);
    await page.waitForTimeout(1000);

    // Click Post — may be a div with role=button
    await page.locator('div[role="button"]:has-text("Post")').last().click();
    await page.waitForTimeout(3000);

    console.log('Posted to Threads successfully');
    return true;
  } catch (err: any) {
    console.error('Threads post error:', err.message);
    return false;
  } finally {
    await browser.close();
  }
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
