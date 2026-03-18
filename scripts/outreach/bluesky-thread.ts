/**
 * Post a weekly Distraction Index thread to Bluesky via AT Protocol API.
 *
 * Generates a 5-7 post thread with week summary data including top events,
 * smokescreen patterns, and stats — then posts as a proper AT Protocol
 * reply chain.
 *
 * Setup:
 *   1. Create a Bluesky account at bsky.app
 *   2. Go to Settings > App Passwords > Create App Password
 *   3. Add to .env.local:
 *      BLUESKY_HANDLE=yourhandle.bsky.social
 *      BLUESKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
 *
 * Usage:
 *   npx tsx scripts/outreach/bluesky-thread.ts [--dry-run]
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { addDays, format } from 'date-fns';

config({ path: resolve(__dirname, '../../.env.local') });

// ---------------------------------------------------------------------------
// Supabase client (distraction schema)
// ---------------------------------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'distraction' } }
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const BLUESKY_AUTH_SERVICE = 'https://bsky.social';
const FIRST_WEEK_START = new Date('2024-12-29T00:00:00');
const MAX_POST_LENGTH = 300;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface BlueskySession {
  did: string;
  accessJwt: string;
  pdsEndpoint: string;
}

interface PostRef {
  uri: string;
  cid: string;
}

interface EventRow {
  id: string;
  title: string;
  a_score: number;
  b_score: number;
  primary_list: string;
  summary: string | null;
}

interface SmokescreenRow {
  distraction_event_id: string;
  damage_event_id: string;
}

// ---------------------------------------------------------------------------
// Week number helper (mirrors src/lib/weeks.ts)
// ---------------------------------------------------------------------------
function getWeekNumber(weekId: string): number {
  const weekStart = new Date(weekId + 'T00:00:00');
  const diffMs = weekStart.getTime() - FIRST_WEEK_START.getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function getWeekDateRange(weekId: string): string {
  const start = new Date(weekId + 'T00:00:00');
  const end = addDays(start, 6);
  return `${format(start, 'MMM d')}–${format(end, 'MMM d, yyyy')}`;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------
async function fetchWeekData() {
  // Get the most recent frozen week
  const { data: weeks } = await supabase
    .from('weekly_snapshots')
    .select('week_id, status')
    .order('week_id', { ascending: false })
    .limit(5);

  const frozenWeek = weeks?.find(w => w.status === 'frozen') || weeks?.[0];
  if (!frozenWeek) throw new Error('No weeks found in database');

  const weekId = frozenWeek.week_id;

  // Get scored events
  const { data: events } = await supabase
    .from('events')
    .select('id, title, a_score, b_score, primary_list, summary')
    .eq('week_id', weekId)
    .not('a_score', 'is', null)
    .order('a_score', { ascending: false });

  if (!events || events.length === 0) {
    throw new Error(`No scored events for week ${weekId}`);
  }

  // Get smokescreen pairs with event details
  const { data: pairs } = await supabase
    .from('smokescreen_pairs')
    .select('distraction_event_id, damage_event_id')
    .eq('week_id', weekId);

  // Get smokescreen pair count
  const { count: smokescreenCount } = await supabase
    .from('smokescreen_pairs')
    .select('*', { count: 'exact', head: true })
    .eq('week_id', weekId);

  return {
    weekId,
    events: events as EventRow[],
    smokescreenPairs: (pairs || []) as SmokescreenRow[],
    smokescreenCount: smokescreenCount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Thread content generation
// ---------------------------------------------------------------------------
function truncateTitle(title: string, maxLen: number): string {
  if (title.length <= maxLen) return title;
  return title.substring(0, maxLen - 1) + '\u2026';
}

function generateThread(
  weekId: string,
  events: EventRow[],
  smokescreenPairs: SmokescreenRow[],
  smokescreenCount: number
): string[] {
  const weekNum = getWeekNumber(weekId);
  const dateRange = getWeekDateRange(weekId);
  const eventsById = new Map(events.map(e => [e.id, e]));

  const sortedByA = [...events].sort((a, b) => b.a_score - a.a_score);
  const sortedByB = [...events].sort((a, b) => b.b_score - a.b_score);
  const topDamage = sortedByA[0];
  const topDistraction = sortedByB[0];

  const avgA = Math.round(events.reduce((s, e) => s + e.a_score, 0) / events.length);
  const avgB = Math.round(events.reduce((s, e) => s + e.b_score, 0) / events.length);

  const posts: string[] = [];

  // --- Post 1: Thread opener ---
  posts.push(
    `\uD83E\uDDF5 This week's Distraction Index (Week ${weekNum}, ${dateRange}): ${events.length} events scored. Here's what the data shows...`
  );

  // --- Post 2: Highest constitutional damage ---
  const damageTitle = truncateTitle(topDamage.title, 120);
  posts.push(
    `Highest constitutional damage: "${damageTitle}" \u2014 ${topDamage.a_score}/100.${topDamage.summary ? ' ' + truncateTitle(topDamage.summary, 300 - damageTitle.length - 60) : ''}`
  );

  // --- Post 3: Biggest distraction ---
  const distrTitle = truncateTitle(topDistraction.title, 120);
  posts.push(
    `Biggest distraction: "${distrTitle}" \u2014 ${topDistraction.b_score}/100 distraction score, but only ${topDistraction.a_score}/100 constitutional damage.`
  );

  // --- Post 4: Smokescreen pattern ---
  if (smokescreenPairs.length > 0) {
    const pair = smokescreenPairs[0];
    const distrEvent = eventsById.get(pair.distraction_event_id);
    const damageEvent = eventsById.get(pair.damage_event_id);

    if (distrEvent && damageEvent) {
      const dTitle = truncateTitle(distrEvent.title, 80);
      const aTitle = truncateTitle(damageEvent.title, 80);
      posts.push(
        `The smokescreen pattern: While "${dTitle}" dominated attention, "${aTitle}" got buried \u2014 scoring ${damageEvent.a_score}/100 damage with far less coverage.`
      );
    } else {
      posts.push(
        `The smokescreen pattern: ${smokescreenCount} pair${smokescreenCount !== 1 ? 's' : ''} detected this week \u2014 high-distraction events covering for high-damage events that got far less attention.`
      );
    }
  } else {
    // No smokescreen pairs — skip this post or use a general observation
    const undercovered = sortedByA.find(e => e.b_score < 30);
    if (undercovered) {
      const uTitle = truncateTitle(undercovered.title, 120);
      posts.push(
        `Undercovered: "${uTitle}" scored ${undercovered.a_score}/100 damage but only ${undercovered.b_score}/100 distraction \u2014 meaning it got far less media attention than it deserved.`
      );
    }
  }

  // --- Post 5: By the numbers ---
  posts.push(
    (() => {
      const high = sortedByA.filter(e => e.a_score >= 70).length;
      return `By the numbers: ${events.length} events, ${avgA} avg damage, ${avgB} avg distraction, ${smokescreenCount} smokescreen pair${smokescreenCount !== 1 ? 's' : ''} detected. ${high} event${high !== 1 ? 's' : ''} scored 70+ constitutional damage.`;
    })()
  );

  // --- Post 6: Full report link + hashtags ---
  const reportUrl = `https://distractionindex.org/week/${weekId}`;
  posts.push(
    `Full report + methodology \u2014 every score, every source, open source: ${reportUrl}\n\n#DistractionIndex #Democracy`
  );

  // Validate all posts are under 300 characters
  for (let i = 0; i < posts.length; i++) {
    if (posts[i].length > MAX_POST_LENGTH) {
      // Trim to fit; prefer cutting the summary/description portion
      posts[i] = posts[i].substring(0, MAX_POST_LENGTH - 3) + '...';
    }
  }

  return posts;
}

// ---------------------------------------------------------------------------
// URL facet detection (byte-accurate for AT Protocol)
// ---------------------------------------------------------------------------
function detectUrlFacets(text: string): any[] {
  const urlRegex = /https?:\/\/[^\s)]+/g;
  const facets: any[] = [];
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const byteStart = Buffer.byteLength(text.substring(0, match.index), 'utf8');
    const byteEnd = byteStart + Buffer.byteLength(match[0], 'utf8');

    facets.push({
      index: { byteStart, byteEnd },
      features: [{
        $type: 'app.bsky.richtext.facet#link',
        uri: match[0],
      }],
    });
  }

  return facets;
}

// ---------------------------------------------------------------------------
// Hashtag facet detection (byte-accurate for AT Protocol)
// ---------------------------------------------------------------------------
function detectHashtagFacets(text: string): any[] {
  const hashtagRegex = /#[A-Za-z0-9_]+/g;
  const facets: any[] = [];
  let match;

  while ((match = hashtagRegex.exec(text)) !== null) {
    const byteStart = Buffer.byteLength(text.substring(0, match.index), 'utf8');
    const byteEnd = byteStart + Buffer.byteLength(match[0], 'utf8');

    facets.push({
      index: { byteStart, byteEnd },
      features: [{
        $type: 'app.bsky.richtext.facet#tag',
        tag: match[0].substring(1), // strip the #
      }],
    });
  }

  return facets;
}

// ---------------------------------------------------------------------------
// Bluesky auth (PDS resolution from DID document)
// ---------------------------------------------------------------------------
async function createSession(): Promise<BlueskySession> {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;

  if (!handle || !password) {
    throw new Error(
      'Missing BLUESKY_HANDLE or BLUESKY_APP_PASSWORD in .env.local.\n' +
      'Create an app password at: bsky.app > Settings > App Passwords'
    );
  }

  const res = await fetch(`${BLUESKY_AUTH_SERVICE}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bluesky auth failed: ${res.status} ${err}`);
  }

  const data = await res.json();

  // Resolve actual PDS endpoint from DID document
  const pdsEndpoint =
    data.didDoc?.service?.find((s: any) => s.id === '#atproto_pds')?.serviceEndpoint
    || BLUESKY_AUTH_SERVICE;

  return { did: data.did, accessJwt: data.accessJwt, pdsEndpoint };
}

// ---------------------------------------------------------------------------
// Post a thread as a reply chain
// ---------------------------------------------------------------------------
async function postThread(session: BlueskySession, posts: string[]): Promise<string> {
  let rootRef: PostRef | null = null;
  let parentRef: PostRef | null = null;

  for (let i = 0; i < posts.length; i++) {
    const text = posts[i];

    // Detect URL and hashtag facets
    const urlFacets = detectUrlFacets(text);
    const hashtagFacets = detectHashtagFacets(text);
    const facets = [...urlFacets, ...hashtagFacets];

    const record: any = {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: new Date().toISOString(),
      langs: ['en'],
    };

    if (facets.length > 0) {
      record.facets = facets;
    }

    // Thread: each post after the first replies to the previous, referencing root
    if (parentRef && rootRef) {
      record.reply = {
        root: rootRef,
        parent: parentRef,
      };
    }

    const res = await fetch(`${session.pdsEndpoint}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: 'app.bsky.feed.post',
        record,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create post ${i + 1}/${posts.length}: ${res.status} ${err}`);
    }

    const result = await res.json();
    const ref: PostRef = { uri: result.uri, cid: result.cid };

    if (!rootRef) rootRef = ref;
    parentRef = ref;

    console.log(`  Posted ${i + 1}/${posts.length} (${text.length} chars)`);
  }

  return rootRef!.uri;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('Fetching current week data from Supabase...');
  const { weekId, events, smokescreenPairs, smokescreenCount } = await fetchWeekData();

  const weekNum = getWeekNumber(weekId);
  const dateRange = getWeekDateRange(weekId);
  console.log(`Week ${weekNum} (${weekId}, ${dateRange}): ${events.length} events, ${smokescreenCount} smokescreen pairs\n`);

  console.log('Generating thread...');
  const posts = generateThread(weekId, events, smokescreenPairs, smokescreenCount);

  console.log(`\n--- Thread preview (${posts.length} posts) ---\n`);
  for (let i = 0; i < posts.length; i++) {
    console.log(`[${i + 1}/${posts.length}] (${posts[i].length} chars)`);
    console.log(posts[i]);
    console.log('');
  }

  // Validate lengths
  const overLimit = posts.filter(p => p.length > MAX_POST_LENGTH);
  if (overLimit.length > 0) {
    console.warn(`WARNING: ${overLimit.length} post(s) were truncated to ${MAX_POST_LENGTH} chars`);
  }

  if (dryRun) {
    console.log('[DRY RUN] Would post thread to Bluesky. Skipping.');
    return;
  }

  console.log('Authenticating with Bluesky...');
  const session = await createSession();
  console.log(`Authenticated as ${process.env.BLUESKY_HANDLE}`);

  console.log(`\nPosting ${posts.length}-post thread...`);
  const rootUri = await postThread(session, posts);

  // Convert AT URI to web URL
  const handle = process.env.BLUESKY_HANDLE;
  const rkey = rootUri.split('/').pop();
  console.log(`\nThread posted successfully!`);
  console.log(`View at: https://bsky.app/profile/${handle}/post/${rkey}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
