/**
 * Post weekly Distraction Index summary to Mastodon.
 *
 * Setup:
 *   1. Create a Mastodon account (e.g., mastodon.social, hachyderm.io)
 *   2. Go to Preferences > Development > New Application
 *      - Name: Distraction Index Bot
 *      - Scopes: write:statuses
 *   3. Copy the access token
 *   4. Add to .env.local:
 *      MASTODON_INSTANCE=https://mastodon.social  (your instance URL)
 *      MASTODON_ACCESS_TOKEN=your_token_here
 *
 * Usage:
 *   npx tsx scripts/outreach/mastodon-post.ts [--dry-run]
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { getCurrentWeekSummary, formatShortPost } from './week-summary';

config({ path: resolve(__dirname, '../../.env.local') });

async function postToMastodon(text: string): Promise<string> {
  const instance = process.env.MASTODON_INSTANCE;
  const token = process.env.MASTODON_ACCESS_TOKEN;

  if (!instance || !token) {
    throw new Error(
      'Missing MASTODON_INSTANCE or MASTODON_ACCESS_TOKEN in .env.local.\n' +
      'Create an app at: your-instance/settings/applications'
    );
  }

  // Mastodon has a 500 char limit (default, some instances allow more)
  const res = await fetch(`${instance}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      status: text,
      visibility: 'public',
      language: 'en',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mastodon post failed: ${res.status} ${err}`);
  }

  const result = await res.json();
  return result.url;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('Fetching current week summary...');
  const summary = await getCurrentWeekSummary();

  // Mastodon supports hashtags — add relevant ones
  const post = formatShortPost(summary) +
    '\n\n#DistractionIndex #Democracy #ConstitutionalRights #Accountability #CivicTech';

  console.log('\n--- Post content ---');
  console.log(post);
  console.log(`--- ${post.length} chars ---\n`);

  if (dryRun) {
    console.log('[DRY RUN] Would post to Mastodon. Skipping.');
    return;
  }

  console.log('Posting to Mastodon...');
  const url = await postToMastodon(post);
  console.log(`Posted successfully: ${url}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
