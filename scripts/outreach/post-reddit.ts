/**
 * Post Distraction Index weekly summary to Reddit via Playwright.
 *
 * Uses browser automation since Reddit API requires app registration.
 * Posts as a text post with fresh week data to relevant subreddits.
 *
 * Setup:
 *   1. npx playwright install chromium
 *   2. Have a Reddit account (will need to log in on first run)
 *   3. Add to .env.local:
 *      REDDIT_USERNAME=your_username
 *      REDDIT_PASSWORD=your_password
 *
 * Usage:
 *   npx tsx scripts/outreach/post-reddit.ts [--dry-run] [--subreddit=politics]
 *
 * IMPORTANT: Reddit has strict self-promotion rules. Follow the 10:1 rule
 * (10 community contributions per 1 self-promotion). Build karma first.
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { getCurrentWeekSummary, type WeekSummary } from './week-summary';

config({ path: resolve(__dirname, '../../.env.local') });

const POST_LOG = resolve(__dirname, 'reddit-posts.json');

interface SubredditTarget {
  name: string;
  titleTemplate: (s: WeekSummary) => string;
  flairText?: string;
  notes: string;
}

const SUBREDDIT_TARGETS: SubredditTarget[] = [
  {
    name: 'politics',
    titleTemplate: (s) => `Weekly Distraction Index (${s.weekId}): ${s.totalEvents} events scored — top damage: "${s.topDamage?.title?.substring(0, 60)}"`,
    notes: 'r/politics allows self-posts. Must follow subreddit rules. High karma requirement.',
  },
  {
    name: 'civictech',
    titleTemplate: (s) => `The Distraction Index: Open-source civic tool scoring democratic damage vs. manufactured distractions`,
    notes: 'Small but engaged community. Tool announcements welcome.',
  },
  {
    name: 'dataisbeautiful',
    titleTemplate: (s) => `[OC] Weekly Index: Constitutional Damage vs. Manufactured Distractions — ${s.totalEvents} political events dual-scored`,
    notes: 'Requires [OC] tag. Data visualization focus. Post on visualization day.',
  },
  {
    name: 'Keep_Track',
    titleTemplate: (s) => `Distraction Index ${s.weekId}: Tracking what constitutional damage is being buried under political noise`,
    notes: 'Dedicated to tracking government actions. Strong thematic fit.',
  },
  {
    name: 'technology',
    titleTemplate: (s) => `Open-source civic tech: The Distraction Index uses AI to score democratic damage vs. manufactured distractions`,
    notes: 'Tech angle — AI/ML scoring, open source, civic application.',
  },
];

function formatRedditBody(summary: WeekSummary): string {
  const lines: string[] = [];

  lines.push(`## This Week's Distraction Index\n`);
  lines.push(`**Week of ${summary.weekId}** | ${summary.totalEvents} events tracked and scored\n`);
  lines.push(`Every event gets two independent scores:`);
  lines.push(`- **A-Score (Constitutional Damage)**: 7 weighted governance drivers measuring real democratic harm`);
  lines.push(`- **B-Score (Distraction/Hype)**: Media spectacle and strategic distraction measurement\n`);

  if (summary.topDamage) {
    lines.push(`### Highest Constitutional Damage`);
    lines.push(`**${summary.topDamage.title}** — A-Score: ${summary.topDamage.scoreA}/100, B-Score: ${summary.topDamage.scoreB}/100\n`);
  }

  if (summary.topDistraction) {
    lines.push(`### Top Distraction`);
    lines.push(`**${summary.topDistraction.title}** — B-Score: ${summary.topDistraction.scoreB}/100, A-Score: ${summary.topDistraction.scoreA}/100\n`);
  }

  if (summary.listA.length > 0) {
    lines.push(`### High Constitutional Damage Events (List A): ${summary.listA.length}`);
    for (const e of summary.listA.slice(0, 5)) {
      lines.push(`- ${e.title} (A: ${e.scoreA}, B: ${e.scoreB})`);
    }
    lines.push('');
  }

  if (summary.smokescreenPairs > 0) {
    lines.push(`### Smokescreen Alert`);
    lines.push(`${summary.smokescreenPairs} high-distraction events appear to be providing cover for high-damage events.\n`);
  }

  lines.push(`---\n`);
  lines.push(`**Full interactive report**: [distractionindex.org/week/${summary.weekId}](https://distractionindex.org/week/${summary.weekId})`);
  lines.push(`**Methodology**: [distractionindex.org/methodology](https://distractionindex.org/methodology)`);
  lines.push(`**Open source**: [GitHub](https://github.com/sgharlow/distraction)\n`);
  lines.push(`---`);
  lines.push(`*Built by an independent developer. No ads, no paywalls, no corporate backing. Just civic data.*`);

  return lines.join('\n');
}

interface PostRecord {
  subreddit: string;
  title: string;
  postedAt: string;
  weekId: string;
}

function loadPostLog(): PostRecord[] {
  if (!existsSync(POST_LOG)) return [];
  return JSON.parse(readFileSync(POST_LOG, 'utf-8'));
}

function savePostLog(log: PostRecord[]): void {
  writeFileSync(POST_LOG, JSON.stringify(log, null, 2));
}

async function postToReddit(
  subreddit: string,
  title: string,
  body: string,
  dryRun: boolean
): Promise<boolean> {
  if (dryRun) {
    console.log(`  [DRY RUN] Would post to r/${subreddit}`);
    console.log(`  Title: ${title}`);
    console.log(`  Body preview: ${body.substring(0, 200)}...`);
    return true;
  }

  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;

  if (!username || !password) {
    throw new Error('Missing REDDIT_USERNAME or REDDIT_PASSWORD in .env.local');
  }

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: false }); // visible for CAPTCHA
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    console.log('  Logging into Reddit...');
    await page.goto('https://www.reddit.com/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="username"], #loginUsername', username);
    await page.fill('input[name="password"], #loginPassword', password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    // Navigate to submit page
    console.log(`  Navigating to r/${subreddit}/submit...`);
    await page.goto(`https://www.reddit.com/r/${subreddit}/submit`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    // Select "Text" post type
    const textTab = await page.$('button:has-text("Text"), [role="tab"]:has-text("Text")');
    if (textTab) await textTab.click();
    await page.waitForTimeout(1000);

    // Fill title
    const titleInput = await page.$('textarea[placeholder*="title" i], input[placeholder*="title" i], [name="title"]');
    if (titleInput) {
      await titleInput.fill(title);
      console.log('  Filled title');
    }

    // Fill body (markdown)
    const bodyInput = await page.$('.public-DraftEditor-content, textarea[placeholder*="text" i], [role="textbox"]');
    if (bodyInput) {
      await bodyInput.click();
      await page.keyboard.type(body, { delay: 5 }); // Type slowly to avoid detection
      console.log('  Filled body');
    }

    // Screenshot before posting
    mkdirSync(resolve(__dirname, 'screenshots'), { recursive: true });
    const ssPath = resolve(__dirname, `screenshots/reddit-${subreddit}.png`);
    await page.screenshot({ path: ssPath, fullPage: true });
    console.log(`  Screenshot: ${ssPath}`);

    // Submit
    const submitBtn = await page.$('button:has-text("Post"), button[type="submit"]:has-text("Post")');
    if (submitBtn) {
      await submitBtn.click();
      console.log('  Post submitted!');
      await page.waitForTimeout(5000);
    } else {
      console.log('  WARNING: Submit button not found. Check screenshot.');
      return false;
    }

    return true;
  } catch (err: any) {
    console.error(`  Reddit post error: ${err.message}`);
    return false;
  } finally {
    await browser.close();
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const subArg = process.argv.find(a => a.startsWith('--subreddit='));
  const targetSub = subArg?.split('=')[1];

  console.log('Fetching current week summary...');
  const summary = await getCurrentWeekSummary();
  const body = formatRedditBody(summary);

  const postLog = loadPostLog();

  let targets = SUBREDDIT_TARGETS;
  if (targetSub) {
    targets = targets.filter(t => t.name.toLowerCase() === targetSub.toLowerCase());
    if (targets.length === 0) {
      console.error(`Unknown subreddit: ${targetSub}`);
      console.log('Available:', SUBREDDIT_TARGETS.map(t => t.name).join(', '));
      process.exit(1);
    }
  }

  // Skip subreddits already posted to this week
  targets = targets.filter(t => {
    const recent = postLog.find(
      p => p.subreddit === t.name && p.weekId === summary.weekId
    );
    if (recent) {
      console.log(`Skipping r/${t.name} — already posted for week ${summary.weekId}`);
    }
    return !recent;
  });

  if (targets.length === 0) {
    console.log('\nNo subreddits to post to. Already posted everywhere this week.');
    return;
  }

  console.log(`\nPosting to ${targets.length} subreddits...\n`);

  for (const target of targets) {
    const title = target.titleTemplate(summary);
    console.log(`\n[r/${target.name}]`);
    console.log(`  Note: ${target.notes}`);

    const ok = await postToReddit(target.name, title, body, dryRun);

    if (ok && !dryRun) {
      postLog.push({
        subreddit: target.name,
        title,
        postedAt: new Date().toISOString(),
        weekId: summary.weekId,
      });
    }

    if (!dryRun) await new Promise(r => setTimeout(r, 10000)); // 10s between posts
  }

  if (!dryRun) savePostLog(postLog);

  console.log('\n=== Reddit posting complete ===');
  if (dryRun) console.log('(DRY RUN — no posts were made)');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
