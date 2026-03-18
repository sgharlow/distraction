/**
 * Bluesky Quote-Post Draft System for the Distraction Index.
 *
 * Monitors recent posts from followed progressive media accounts and generates
 * data-enriched reply/quote-post suggestions using current DI week data.
 *
 * NEVER auto-posts. All output is for USER review only.
 *
 * Setup:
 *   1. BLUESKY_HANDLE and BLUESKY_APP_PASSWORD in .env.local (same as bluesky-post.ts)
 *   2. Supabase credentials in .env.local (same as bluesky-thread.ts)
 *
 * Usage:
 *   npx tsx scripts/outreach/bluesky-engage.ts [--dry-run] [--limit=10]
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

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
const BLUESKY_PUBLIC_API = 'https://public.api.bsky.app';
const MAX_POST_LENGTH = 300;
const SITE_URL = 'https://distractionindex.org';

/**
 * Progressive media accounts we follow and want to engage with.
 * Handle format: without the leading @.
 */
const TARGET_ACCOUNTS: { handle: string; displayName: string }[] = [
  { handle: 'katiephang.bsky.social', displayName: 'Katie Phang' },
  { handle: 'meidastouch.bsky.social', displayName: 'MeidasTouch' },
  { handle: 'adammockler.bsky.social', displayName: 'Adam Mockler' },
  { handle: 'mspopok.bsky.social', displayName: 'Ms. Popok' },
  { handle: 'acyn.bsky.social', displayName: 'Acyn' },
  { handle: 'muellerseineagain.bsky.social', displayName: 'Mueller She Wrote' },
  { handle: 'briantylercohen.bsky.social', displayName: 'Brian Tyler Cohen' },
  { handle: 'rbreich.bsky.social', displayName: 'Robert Reich' },
  { handle: 'chrislhayes.bsky.social', displayName: 'Chris Hayes' },
  { handle: 'joyannreid.bsky.social', displayName: 'Joy Reid' },
  { handle: 'maddow.bsky.social', displayName: 'Rachel Maddow' },
  { handle: 'praborton.bsky.social', displayName: 'Prab Orton' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface BlueskySession {
  did: string;
  accessJwt: string;
  pdsEndpoint: string;
}

interface TimelinePost {
  uri: string;
  cid: string;
  authorHandle: string;
  authorDisplayName: string;
  text: string;
  createdAt: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
}

interface EventRow {
  id: string;
  title: string;
  a_score: number;
  b_score: number;
  primary_list: string;
  summary: string | null;
  tags: string[] | null;
}

interface EngagementDraft {
  post: TimelinePost;
  matchedEvents: EventRow[];
  draftText: string;
  action: 'QUOTE-POST' | 'REPLY';
  weekId: string;
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
// Fetch authenticated user's timeline (last N posts)
// ---------------------------------------------------------------------------
async function fetchTimeline(session: BlueskySession, limit: number): Promise<TimelinePost[]> {
  const res = await fetch(
    `${session.pdsEndpoint}/xrpc/app.bsky.feed.getTimeline?limit=${limit}`,
    {
      headers: { 'Authorization': `Bearer ${session.accessJwt}` },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch timeline: ${res.status} ${err}`);
  }

  const data = await res.json();
  const posts: TimelinePost[] = [];

  for (const item of data.feed || []) {
    const post = item.post;
    if (!post?.record?.text) continue;

    // Skip reposts — we want original posts only
    if (item.reason?.$type === 'app.bsky.feed.defs#reasonRepost') continue;

    posts.push({
      uri: post.uri,
      cid: post.cid,
      authorHandle: post.author?.handle || 'unknown',
      authorDisplayName: post.author?.displayName || post.author?.handle || 'unknown',
      text: post.record.text,
      createdAt: post.record.createdAt || post.indexedAt,
      likeCount: post.likeCount ?? 0,
      repostCount: post.repostCount ?? 0,
      replyCount: post.replyCount ?? 0,
    });
  }

  return posts;
}

// ---------------------------------------------------------------------------
// Filter posts from target accounts
// ---------------------------------------------------------------------------
function filterTargetPosts(posts: TimelinePost[]): TimelinePost[] {
  const targetHandles = new Set(TARGET_ACCOUNTS.map(a => a.handle.toLowerCase()));

  return posts.filter(p => targetHandles.has(p.authorHandle.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Fetch current week's events from Supabase
// ---------------------------------------------------------------------------
async function fetchCurrentWeekEvents(): Promise<{ weekId: string; events: EventRow[] }> {
  // Get the most recent frozen week (has complete data)
  const { data: weeks } = await supabase
    .from('weekly_snapshots')
    .select('week_id, status')
    .order('week_id', { ascending: false })
    .limit(5);

  const frozenWeek = weeks?.find(w => w.status === 'frozen') || weeks?.[0];
  if (!frozenWeek) throw new Error('No weeks found in database');

  const weekId = frozenWeek.week_id;

  // Get scored events with tags
  const { data: events } = await supabase
    .from('events')
    .select('id, title, a_score, b_score, primary_list, summary, tags')
    .eq('week_id', weekId)
    .not('a_score', 'is', null)
    .order('a_score', { ascending: false });

  if (!events || events.length === 0) {
    throw new Error(`No scored events for week ${weekId}`);
  }

  return { weekId, events: events as EventRow[] };
}

// ---------------------------------------------------------------------------
// Keyword matching: find DI events relevant to a post
// ---------------------------------------------------------------------------
function matchEventsToPost(postText: string, events: EventRow[]): EventRow[] {
  const postLower = postText.toLowerCase();
  const postWords = new Set(
    postLower
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3) // skip short words
  );

  // High-value political keywords that appear in both posts and event titles
  const politicalKeywords = [
    'supreme court', 'scotus', 'congress', 'senate', 'house',
    'trump', 'biden', 'executive order', 'impeach', 'indictment',
    'immigration', 'border', 'deportation', 'daca',
    'abortion', 'roe', 'reproductive',
    'voting', 'election', 'ballot', 'gerrymandering',
    'classified', 'documents', 'investigation', 'subpoena',
    'medicare', 'medicaid', 'social security', 'healthcare',
    'tariff', 'trade war', 'sanctions',
    'nato', 'ukraine', 'russia', 'china',
    'climate', 'epa', 'environment',
    'doj', 'fbi', 'justice department',
    'first amendment', 'press freedom', 'censorship',
    'insurrection', 'january 6', 'jan 6',
    'constitution', 'amendment', 'rule of law',
    'doge', 'musk', 'government efficiency',
    'shutdown', 'debt ceiling', 'budget',
    'federal judge', 'judicial', 'court ruling',
    'pardon', 'commute', 'clemency',
    'whistleblower', 'inspector general',
    'fda', 'cdc', 'public health',
    'education', 'student loans', 'title ix',
    'military', 'pentagon', 'defense',
  ];

  const scored: { event: EventRow; score: number }[] = [];

  for (const event of events) {
    let matchScore = 0;
    const titleLower = event.title.toLowerCase();
    const summaryLower = (event.summary || '').toLowerCase();
    const tagsList = (event.tags || []).map(t => t.toLowerCase());

    // Check political phrase matches (highest weight)
    for (const phrase of politicalKeywords) {
      const inPost = postLower.includes(phrase);
      const inEvent = titleLower.includes(phrase) || summaryLower.includes(phrase) || tagsList.some(t => t.includes(phrase));
      if (inPost && inEvent) {
        matchScore += 5;
      }
    }

    // Check individual word overlap between post and event title
    const titleWords = new Set(
      titleLower
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3)
    );

    for (const word of titleWords) {
      if (postWords.has(word)) {
        matchScore += 1;
      }
    }

    // Check tag matches
    for (const tag of tagsList) {
      if (postLower.includes(tag)) {
        matchScore += 3;
      }
    }

    if (matchScore > 0) {
      scored.push({ event, score: matchScore });
    }
  }

  // Return top matches (threshold: at least 2 match points)
  return scored
    .filter(s => s.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.event);
}

// ---------------------------------------------------------------------------
// Draft generation
// ---------------------------------------------------------------------------
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 1) + '\u2026';
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

function generateDraft(post: TimelinePost, matchedEvents: EventRow[], weekId: string): string {
  const weekUrl = `${SITE_URL}/week/${weekId}`;
  const topEvent = matchedEvents[0];

  // Determine if the post topic aligns more with damage or distraction
  const isDamagePost = topEvent.primary_list === 'A';
  const isDistractionPost = topEvent.primary_list === 'B';

  let draft: string;

  if (isDamagePost) {
    // For damage-focused posts, reinforce with DI data
    const eventTitle = truncate(topEvent.title, 80);
    draft = `The Distraction Index scored "${eventTitle}" ${topEvent.a_score}/100 for constitutional damage this week`;

    // If there's a contrasting distraction event, add the smokescreen angle
    const distractionEvent = matchedEvents.find(e => e.primary_list === 'B');
    if (distractionEvent) {
      draft += ` \u2014 while "${truncate(distractionEvent.title, 60)}" got far more coverage at only ${distractionEvent.a_score}/100 damage`;
    }

    draft += `. Data: ${weekUrl}`;
  } else if (isDistractionPost) {
    // For distraction-focused posts, highlight what's being missed
    const eventTitle = truncate(topEvent.title, 80);
    draft = `Our data shows "${eventTitle}" scored ${topEvent.b_score}/100 distraction but only ${topEvent.a_score}/100 constitutional damage`;

    // Find a high-damage event that got less attention
    const hiddenDamage = matchedEvents.find(e => e.primary_list === 'A' && e.a_score > topEvent.a_score);
    if (hiddenDamage) {
      draft += `. Meanwhile "${truncate(hiddenDamage.title, 60)}" scored ${hiddenDamage.a_score}/100 damage with less coverage`;
    }

    draft += `. Full report: ${weekUrl}`;
  } else {
    // Generic data-enriched response
    const eventTitle = truncate(topEvent.title, 80);
    draft = `The Distraction Index tracks this \u2014 "${eventTitle}" scored ${topEvent.a_score}/100 damage, ${topEvent.b_score}/100 distraction. See how it compares: ${weekUrl}`;
  }

  // Enforce max length
  if (draft.length > MAX_POST_LENGTH) {
    // Shorten by removing the comparison part, keep core data point + link
    const eventTitle = truncate(topEvent.title, 80);
    draft = `DI data: "${eventTitle}" scored ${topEvent.a_score}/100 damage, ${topEvent.b_score}/100 distraction this week. ${weekUrl}`;
  }

  if (draft.length > MAX_POST_LENGTH) {
    draft = draft.substring(0, MAX_POST_LENGTH - 3) + '...';
  }

  return draft;
}

function chooseDraftAction(post: TimelinePost, matchedEvents: EventRow[]): 'QUOTE-POST' | 'REPLY' {
  // Prefer quote-post for high-engagement posts (amplifies reach)
  // Prefer reply for lower-engagement posts (direct conversation)
  const engagement = post.likeCount + post.repostCount * 2;
  if (engagement > 50) return 'QUOTE-POST';
  return 'REPLY';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const feedLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

  // This script NEVER auto-posts. --dry-run is the default and only mode.
  console.log('[DRY RUN] Generating engagement drafts for USER review. Nothing will be posted.\n');

  // Step 1: Authenticate with Bluesky
  console.log('Authenticating with Bluesky...');
  const session = await createSession();
  console.log(`Authenticated as ${process.env.BLUESKY_HANDLE}\n`);

  // Step 2: Fetch timeline
  console.log(`Fetching timeline (last ${feedLimit} posts)...`);
  const allPosts = await fetchTimeline(session, feedLimit);
  console.log(`Fetched ${allPosts.length} posts from timeline\n`);

  // Step 3: Filter for target accounts
  const targetPosts = filterTargetPosts(allPosts);
  console.log(`Found ${targetPosts.length} posts from target accounts:`);
  const seenHandles = new Set(targetPosts.map(p => p.authorHandle));
  for (const handle of seenHandles) {
    const count = targetPosts.filter(p => p.authorHandle === handle).length;
    const name = TARGET_ACCOUNTS.find(a => a.handle.toLowerCase() === handle.toLowerCase())?.displayName || handle;
    console.log(`  - ${name} (@${handle}): ${count} post(s)`);
  }
  console.log('');

  if (targetPosts.length === 0) {
    console.log('No posts from target accounts in recent timeline. Try increasing --limit.');
    console.log(`\nTarget accounts monitored (${TARGET_ACCOUNTS.length}):`);
    for (const acct of TARGET_ACCOUNTS) {
      console.log(`  - ${acct.displayName} (@${acct.handle})`);
    }
    return;
  }

  // Step 4: Fetch DI week data
  console.log('Fetching current week events from Supabase...');
  const { weekId, events } = await fetchCurrentWeekEvents();
  console.log(`Week ${weekId}: ${events.length} scored events\n`);

  // Step 5: Generate drafts
  const drafts: EngagementDraft[] = [];

  for (const post of targetPosts) {
    const matchedEvents = matchEventsToPost(post.text, events);
    if (matchedEvents.length === 0) continue;

    const draftText = generateDraft(post, matchedEvents, weekId);
    const action = chooseDraftAction(post, matchedEvents);

    drafts.push({
      post,
      matchedEvents,
      draftText,
      action,
      weekId,
    });
  }

  // Step 6: Output drafts
  if (drafts.length === 0) {
    console.log('No matching posts found. The target accounts\' recent posts did not match any DI events this week.');
    console.log('\nTop 5 DI events this week:');
    for (const e of events.slice(0, 5)) {
      console.log(`  - "${truncate(e.title, 80)}" (A:${e.a_score} B:${e.b_score} List:${e.primary_list})`);
    }
    return;
  }

  console.log(`=== Engagement Drafts (${drafts.length} found) ===\n`);

  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];
    const timeAgo = formatTimeAgo(d.post.createdAt);
    const originalPreview = truncate(d.post.text.replace(/\n/g, ' '), 120);
    const engagement = `${d.post.likeCount} likes, ${d.post.repostCount} reposts, ${d.post.replyCount} replies`;

    console.log(`[${i + 1}] Reply to @${d.post.authorHandle} (${timeAgo}):`);
    console.log(`    Original: "${originalPreview}"`);
    console.log(`    Engagement: ${engagement}`);
    console.log(`    Matched DI events: ${d.matchedEvents.map(e => `"${truncate(e.title, 50)}" (A:${e.a_score})`).join(', ')}`);
    console.log(`    Draft (${d.draftText.length} chars): ${d.draftText}`);
    console.log(`    Action: [${d.action}] or [SKIP]`);
    console.log(`    Post URI: ${d.post.uri}`);
    console.log('');
  }

  console.log('---');
  console.log(`Week report: ${SITE_URL}/week/${weekId}`);
  console.log(`\nTo post manually: Copy a draft, go to bsky.app, find the original post, and quote-post or reply.`);
  console.log('This script does NOT auto-post. All engagement must be user-initiated.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
