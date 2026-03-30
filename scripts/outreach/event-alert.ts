/**
 * Event-driven high-score alert posting.
 *
 * When an event scores >= 80 for a_score (constitutional damage), auto-generate
 * and post an alert to all active platforms. Tracks already-alerted events in
 * alert-history.json to avoid duplicate posts.
 *
 * Designed to be called:
 *   1. Manually: npx tsx scripts/outreach/event-alert.ts [--dry-run]
 *   2. From the pipeline: after /api/process completes scoring
 *   3. Periodically: as part of the scheduler or a separate cron
 *
 * Usage:
 *   npx tsx scripts/outreach/event-alert.ts              # Post alerts for new high-score events
 *   npx tsx scripts/outreach/event-alert.ts --dry-run    # Preview without posting
 *   npx tsx scripts/outreach/event-alert.ts --threshold 70  # Custom threshold (default: 80)
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { postToTwitter } from './twitter-post';

config({ path: resolve(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'distraction' } }
);

const ALERT_HISTORY_FILE = resolve(__dirname, 'alert-history.json');
const DEFAULT_THRESHOLD = 80;

// ---------------------------------------------------------------------------
// Alert history persistence
// ---------------------------------------------------------------------------
interface AlertRecord {
  eventId: string;
  title: string;
  aScore: number;
  weekId: string;
  alertedAt: string;
  platforms: { [platform: string]: boolean };
}

function loadAlertHistory(): AlertRecord[] {
  if (!existsSync(ALERT_HISTORY_FILE)) return [];
  return JSON.parse(readFileSync(ALERT_HISTORY_FILE, 'utf-8'));
}

function saveAlertHistory(history: AlertRecord[]): void {
  writeFileSync(ALERT_HISTORY_FILE, JSON.stringify(history, null, 2));
}

function isAlreadyAlerted(history: AlertRecord[], eventId: string): boolean {
  return history.some(h => h.eventId === eventId);
}

// ---------------------------------------------------------------------------
// Get current live week
// ---------------------------------------------------------------------------
async function getCurrentWeekId(): Promise<string> {
  const { data: weeks } = await supabase
    .from('weekly_snapshots')
    .select('week_id, status')
    .order('week_id', { ascending: false })
    .limit(3);

  if (!weeks || weeks.length === 0) throw new Error('No weeks found');

  // Prefer the most recent 'live' week; fall back to latest overall
  const liveWeek = weeks.find(w => w.status === 'live');
  return liveWeek ? liveWeek.week_id : weeks[0].week_id;
}

// ---------------------------------------------------------------------------
// Fetch high-score events
// ---------------------------------------------------------------------------
async function getHighScoreEvents(weekId: string, threshold: number) {
  const { data } = await supabase
    .from('events')
    .select('id, title, a_score, b_score, primary_list, summary, week_id')
    .eq('week_id', weekId)
    .not('a_score', 'is', null)
    .gte('a_score', threshold)
    .order('a_score', { ascending: false });
  return data || [];
}

// ---------------------------------------------------------------------------
// Generate alert post text
// ---------------------------------------------------------------------------
function generateAlertText(event: {
  id: string;
  title: string;
  a_score: number;
  b_score: number;
  summary?: string | null;
}): string {
  const coverageGap = Math.round(event.a_score - event.b_score);
  const coverageNote =
    coverageGap > 30
      ? `Media attention is only ${Math.round(event.b_score)}/100 — a ${coverageGap}-point coverage gap.`
      : event.b_score > 60
        ? `Getting ${Math.round(event.b_score)}/100 media attention — but is the coverage substantive?`
        : `Media attention: ${Math.round(event.b_score)}/100.`;

  const lines = [
    `HIGH DAMAGE ALERT: "${event.title}"`,
    '',
    `Constitutional damage score: ${event.a_score}/100`,
    coverageNote,
    '',
    `Full analysis: https://distractionindex.org/event/${event.id}`,
  ];

  const text = lines.join('\n');

  // Ensure under 300 chars for Bluesky
  if (text.length <= 300) return text;

  // Truncate title if needed
  const maxTitleLen = 300 - (text.length - event.title.length) - 3;
  const truncTitle = event.title.substring(0, maxTitleLen) + '\u2026';
  return lines
    .map((l, i) => (i === 0 ? `HIGH DAMAGE ALERT: "${truncTitle}"` : l))
    .join('\n');
}

// ---------------------------------------------------------------------------
// Post to platforms (reuses patterns from scheduler.ts)
// ---------------------------------------------------------------------------
async function postToBluesky(text: string): Promise<{ success: boolean; error?: string }> {
  try {
    const handle = process.env.BLUESKY_HANDLE;
    const password = process.env.BLUESKY_APP_PASSWORD;
    if (!handle || !password) return { success: false, error: 'Missing credentials' };

    const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: handle, password }),
    });
    if (!sessionRes.ok) return { success: false, error: `Auth failed: ${sessionRes.status}` };
    const session = await sessionRes.json();
    const pdsEndpoint =
      session.didDoc?.service?.find((s: any) => s.id === '#atproto_pds')?.serviceEndpoint ||
      'https://bsky.social';

    // Detect URL facets
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

    const record: any = {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: new Date().toISOString(),
      langs: ['en'],
    };
    if (facets.length > 0) record.facets = facets;

    const postRes = await fetch(`${pdsEndpoint}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({ repo: session.did, collection: 'app.bsky.feed.post', record }),
    });

    if (!postRes.ok) {
      const err = await postRes.text();
      return { success: false, error: `Post failed: ${postRes.status} ${err}` };
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

    const mastodonText = text + '\n\n#DistractionIndex #Democracy #ConstitutionalRights #HighDamage';

    const res = await fetch(`${instance}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: mastodonText, visibility: 'public', language: 'en' }),
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const thresholdArg = process.argv.indexOf('--threshold');
  const threshold =
    thresholdArg !== -1 && process.argv[thresholdArg + 1]
      ? parseInt(process.argv[thresholdArg + 1], 10)
      : DEFAULT_THRESHOLD;

  console.log(`=== Event Alert System (threshold: ${threshold}) ===\n`);

  const weekId = await getCurrentWeekId();
  console.log(`Current week: ${weekId}`);

  const highScoreEvents = await getHighScoreEvents(weekId, threshold);
  console.log(`Found ${highScoreEvents.length} events with a_score >= ${threshold}\n`);

  if (highScoreEvents.length === 0) {
    console.log('No high-score events to alert on. Done.');
    return;
  }

  const history = loadAlertHistory();
  const newEvents = highScoreEvents.filter(e => !isAlreadyAlerted(history, e.id));

  console.log(`Already alerted: ${highScoreEvents.length - newEvents.length}`);
  console.log(`New alerts needed: ${newEvents.length}\n`);

  if (newEvents.length === 0) {
    console.log('All high-score events already alerted. Done.');
    return;
  }

  for (const event of newEvents) {
    const alertText = generateAlertText(event);
    console.log(`--- Alert for: "${event.title}" (a_score: ${event.a_score}) ---`);
    console.log(`Text (${alertText.length} chars):`);
    console.log(alertText);
    console.log('');

    if (dryRun) {
      console.log('[DRY RUN] Would post to all platforms. Skipping.\n');
      continue;
    }

    // Post to API platforms
    console.log('  Posting to Bluesky...');
    const bsky = await postToBluesky(alertText);
    console.log(`  Bluesky: ${bsky.success ? 'SUCCESS' : 'FAILED: ' + bsky.error}`);

    console.log('  Posting to Mastodon...');
    const masto = await postToMastodon(alertText);
    console.log(`  Mastodon: ${masto.success ? 'SUCCESS' : 'FAILED: ' + masto.error}`);

    console.log('  Posting to Twitter/X...');
    let twitter: { success: boolean; error?: string };
    try {
      twitter = await postToTwitter(alertText);
    } catch (e: any) {
      twitter = { success: false, error: e.message };
    }
    console.log(`  Twitter/X: ${twitter.success ? 'SUCCESS' : 'FAILED: ' + twitter.error}`);

    // Record alert
    const record: AlertRecord = {
      eventId: event.id,
      title: event.title,
      aScore: event.a_score,
      weekId: event.week_id,
      alertedAt: new Date().toISOString(),
      platforms: {
        bluesky: bsky.success,
        mastodon: masto.success,
        twitter: twitter.success,
      },
    };
    history.push(record);
    saveAlertHistory(history);
    console.log(`  Alert recorded. Total alerts: ${history.length}\n`);

    // Rate limit: 5s between alerts
    if (newEvents.indexOf(event) < newEvents.length - 1) {
      console.log('  Waiting 5s before next alert...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log(`\n=== Done. ${newEvents.length} new alert(s) processed. ===`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
