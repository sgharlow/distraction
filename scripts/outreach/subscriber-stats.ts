/**
 * Check newsletter subscriber stats from Supabase.
 *
 * Usage:
 *   npx tsx scripts/outreach/subscriber-stats.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function query(table: string, params: string = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Profile': 'distraction',
      'Accept-Profile': 'distraction',
      'Prefer': 'count=exact',
    },
  });
  const count = res.headers.get('content-range')?.split('/')[1] ?? '?';
  const data = await res.json();
  return { data, count };
}

async function main() {
  console.log('\n=== Newsletter Subscriber Stats ===\n');

  // Total subscribers
  const { count: total } = await query('email_subscribers', 'select=id');
  console.log(`Total signups:     ${total}`);

  // Confirmed subscribers
  const { count: confirmed } = await query('email_subscribers', 'select=id&confirmed=eq.true');
  console.log(`Confirmed:         ${confirmed}`);

  // Unsubscribed
  const { count: unsub } = await query('email_subscribers', 'select=id&unsubscribed_at=not.is.null');
  console.log(`Unsubscribed:      ${unsub}`);

  // Recent signups (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recent } = await query('email_subscribers', `select=id&created_at=gte.${weekAgo}`);
  console.log(`Last 7 days:       ${recent}`);

  // Blog posts
  const { count: posts } = await query('blog_posts', 'select=id');
  console.log(`\nBlog posts:        ${posts}`);

  // Outreach emails sent
  const { readFileSync, existsSync } = await import('fs');
  const sentLog = resolve(__dirname, 'email-sent-log.json');
  if (existsSync(sentLog)) {
    const log = JSON.parse(readFileSync(sentLog, 'utf-8'));
    const initial = log.filter((e: any) => e.type === 'initial').length;
    const followups = log.filter((e: any) => e.type.startsWith('followup')).length;
    console.log(`\nOutreach emails:   ${log.length} total (${initial} initial, ${followups} follow-ups)`);
  }

  // Post history
  const historyFile = resolve(__dirname, 'post-history.json');
  if (existsSync(historyFile)) {
    const history = JSON.parse(readFileSync(historyFile, 'utf-8'));
    const platforms = { bluesky: 0, mastodon: 0, threads: 0, linkedin: 0, twitter: 0 };
    for (const h of history) {
      if (h.bluesky?.success) platforms.bluesky++;
      if (h.mastodon?.success) platforms.mastodon++;
      if (h.threads?.success) platforms.threads++;
      if (h.linkedin?.success) platforms.linkedin++;
      if (h.twitter?.success) platforms.twitter++;
    }
    console.log(`\nSocial posts (all time):`);
    console.log(`  Bluesky:   ${platforms.bluesky}`);
    console.log(`  Mastodon:  ${platforms.mastodon}`);
    console.log(`  Threads:   ${platforms.threads}`);
    console.log(`  LinkedIn:  ${platforms.linkedin}`);
    console.log(`  Twitter/X: ${platforms.twitter}`);
    console.log(`  Total:     ${history.length} scheduled posts`);
  }

  console.log('');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
