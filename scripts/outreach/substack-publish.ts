/**
 * Auto-publish the latest blog post to Substack.
 * Uses Playwright browser automation (requires non-headless for Substack).
 *
 * Designed to run locally via Task Scheduler after the weekly freeze.
 * NOT suitable for Vercel serverless.
 *
 * Usage:
 *   npx tsx scripts/outreach/substack-publish.ts              # Publish latest
 *   npx tsx scripts/outreach/substack-publish.ts --dry-run     # Preview only
 *   npx tsx scripts/outreach/substack-publish.ts --week 2026-03-08  # Specific week
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUBSTACK_URL = 'https://distractionindex.substack.com';

async function supabaseQuery(table: string, params: string = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Profile': 'distraction',
      'Accept-Profile': 'distraction',
    },
  });
  return res.json();
}

function getWeekNumber(weekId: string): number {
  const firstWeek = new Date('2024-12-29');
  const thisWeek = new Date(weekId);
  return Math.round((thisWeek.getTime() - firstWeek.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const weekArg = args.includes('--week') ? args[args.indexOf('--week') + 1] : null;

  // Get the latest blog post (or specific week)
  let params = 'order=published_at.desc&limit=1';
  if (weekArg) params = `week_id=eq.${weekArg}&limit=1`;

  const posts = await supabaseQuery('blog_posts', params);
  if (!posts?.length) {
    console.log('No blog posts found.');
    return;
  }

  const post = posts[0];
  const weekNum = post.week_id ? getWeekNumber(post.week_id) : null;
  console.log(`Publishing to Substack: "${post.title}"`);
  console.log(`  Week: ${weekNum}, Words: ${post.word_count}`);

  if (dryRun) {
    console.log('\n[DRY RUN] Would publish:');
    console.log(`  Title: ${post.title}`);
    console.log(`  Subtitle: ${post.meta_description}`);
    console.log(`  Body: ${post.body_markdown.substring(0, 200)}...`);
    return;
  }

  const { chromium } = await import('playwright');

  // Use persistent context for Substack session
  const userDataDir = resolve(__dirname, '.substack-session');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    timeout: 60000,
  });
  const page = context.pages()[0] || await context.newPage();

  try {
    // Navigate to new post editor
    await page.goto(`${SUBSTACK_URL}/publish/post`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Check if we need to log in
    const url = page.url();
    if (url.includes('sign-in') || url.includes('login')) {
      console.log('  Substack session expired. Please log in manually first.');
      console.log('  Run: npx playwright open https://distractionindex.substack.com/publish/home');
      await context.close();
      return;
    }

    // Fill title
    const titleInput = page.getByTestId('post-title');
    await titleInput.waitFor({ state: 'visible', timeout: 10000 });
    await titleInput.fill(post.title);
    await page.waitForTimeout(500);

    // Fill subtitle
    const subtitleInput = page.getByRole('textbox', { name: /subtitle/i });
    if (await subtitleInput.isVisible().catch(() => false)) {
      await subtitleInput.fill(post.meta_description || '');
      await page.waitForTimeout(500);
    }

    // Fill body
    const editor = page.locator('div[contenteditable="true"]').first();
    await editor.click();
    await page.waitForTimeout(300);
    await page.keyboard.type(post.body_markdown, { delay: 0 });
    await page.waitForTimeout(2000);

    // Click Continue/Publish
    const publishBtn = page.getByTestId('publish-button');
    await publishBtn.click();
    await page.waitForTimeout(2000);

    // Click "Send to everyone now"
    const sendBtn = page.getByRole('button', { name: /send to everyone/i });
    if (await sendBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sendBtn.click();
      await page.waitForTimeout(3000);

      // Handle subscribe buttons dialog
      const addBtnsBtn = page.getByRole('button', { name: /add subscribe buttons/i });
      if (await addBtnsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addBtnsBtn.click();
      }

      console.log('  SUCCESS — Published to Substack!');
    } else {
      console.log('  Could not find publish confirmation button');
    }
  } catch (e: any) {
    console.log(`  ERROR: ${e.message.substring(0, 100)}`);
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
