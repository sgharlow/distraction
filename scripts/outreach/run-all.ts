/**
 * Orchestrator: Run all outreach channels in sequence.
 *
 * Usage:
 *   npx tsx scripts/outreach/run-all.ts [--dry-run]
 *   npx tsx scripts/outreach/run-all.ts --channels=bluesky,mastodon,email
 *
 * Available channels:
 *   bluesky   - Post weekly summary to Bluesky
 *   mastodon  - Post weekly summary to Mastodon
 *   email     - Send follow-up emails (use --new-targets for constitutional orgs)
 *   forms     - Submit contact forms via Playwright
 *   reddit    - Post to relevant subreddits
 *
 * Recommended weekly workflow:
 *   1. Run on Sunday/Monday after week freezes:
 *      npx tsx scripts/outreach/run-all.ts --channels=bluesky,mastodon
 *
 *   2. Run monthly for email campaigns:
 *      npx tsx scripts/outreach/email-campaign.ts --new-targets --dry-run
 *      npx tsx scripts/outreach/email-campaign.ts --followup --dry-run
 *
 *   3. Run quarterly for contact form submissions:
 *      npx tsx scripts/outreach/submit-contact-forms.ts --dry-run
 */
import { execSync } from 'child_process';
import { resolve } from 'path';

const SCRIPT_DIR = resolve(__dirname);

const CHANNELS: Record<string, { script: string; args: string[]; description: string }> = {
  bluesky: {
    script: 'bluesky-post.ts',
    args: [],
    description: 'Post weekly summary to Bluesky',
  },
  mastodon: {
    script: 'mastodon-post.ts',
    args: [],
    description: 'Post weekly summary to Mastodon',
  },
  email: {
    script: 'email-campaign.ts',
    args: ['--followup'],
    description: 'Send follow-up emails to non-responders',
  },
  forms: {
    script: 'submit-contact-forms.ts',
    args: [],
    description: 'Submit contact forms via Playwright',
  },
  reddit: {
    script: 'post-reddit.ts',
    args: [],
    description: 'Post to relevant subreddits',
  },
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const channelArg = process.argv.find(a => a.startsWith('--channels='));
  const selectedChannels = channelArg
    ? channelArg.split('=')[1].split(',')
    : Object.keys(CHANNELS);

  console.log('=== Distraction Index Outreach Runner ===\n');
  console.log(`Channels: ${selectedChannels.join(', ')}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  for (const channel of selectedChannels) {
    const config = CHANNELS[channel];
    if (!config) {
      console.error(`Unknown channel: ${channel}`);
      console.log(`Available: ${Object.keys(CHANNELS).join(', ')}`);
      continue;
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`Channel: ${channel} — ${config.description}`);
    console.log('='.repeat(50));

    const args = [...config.args];
    if (dryRun) args.push('--dry-run');

    const cmd = `npx tsx "${resolve(SCRIPT_DIR, config.script)}" ${args.join(' ')}`;

    try {
      execSync(cmd, {
        stdio: 'inherit',
        cwd: resolve(__dirname, '../..'),
        env: process.env,
        timeout: 120000, // 2 min per channel
      });
      console.log(`\n[${channel}] Complete.`);
    } catch (err: any) {
      console.error(`\n[${channel}] Failed: ${err.message}`);
      // Continue with next channel
    }
  }

  console.log('\n=== All channels processed ===');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
