/**
 * Post weekly Distraction Index summary to Bluesky via AT Protocol API.
 *
 * Setup:
 *   1. Create a Bluesky account at bsky.app
 *   2. Go to Settings > App Passwords > Create App Password
 *   3. Add to .env.local:
 *      BLUESKY_HANDLE=yourhandle.bsky.social
 *      BLUESKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
 *
 * Usage:
 *   npx tsx scripts/outreach/bluesky-post.ts [--dry-run]
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { getCurrentWeekSummary, formatShortPost } from './week-summary';

config({ path: resolve(__dirname, '../../.env.local') });

const BLUESKY_SERVICE = 'https://bsky.social';

interface BlueskySession {
  did: string;
  accessJwt: string;
}

async function createSession(): Promise<BlueskySession> {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;

  if (!handle || !password) {
    throw new Error(
      'Missing BLUESKY_HANDLE or BLUESKY_APP_PASSWORD in .env.local.\n' +
      'Create an app password at: bsky.app > Settings > App Passwords'
    );
  }

  const res = await fetch(`${BLUESKY_SERVICE}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bluesky auth failed: ${res.status} ${err}`);
  }

  return res.json();
}

async function createPost(session: BlueskySession, text: string): Promise<string> {
  // Bluesky posts have a 300 grapheme limit. We need to handle this.
  // For longer posts, we'll create a thread.
  const chunks = splitIntoChunks(text, 290);

  let parentRef: { uri: string; cid: string } | null = null;
  let rootRef: { uri: string; cid: string } | null = null;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = i < chunks.length - 1 ? chunks[i] + ' (cont.)' : chunks[i];

    // Detect URLs and create facets for them
    const facets = detectUrlFacets(chunk);

    const record: any = {
      $type: 'app.bsky.feed.post',
      text: chunk,
      createdAt: new Date().toISOString(),
      langs: ['en'],
    };

    if (facets.length > 0) {
      record.facets = facets;
    }

    if (parentRef) {
      record.reply = {
        root: rootRef,
        parent: parentRef,
      };
    }

    const res = await fetch(`${BLUESKY_SERVICE}/xrpc/com.atproto.repo.createRecord`, {
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
      throw new Error(`Failed to create post: ${res.status} ${err}`);
    }

    const result = await res.json();
    const ref = { uri: result.uri, cid: result.cid };

    if (!rootRef) rootRef = ref;
    parentRef = ref;
  }

  return parentRef!.uri;
}

function splitIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  const lines = text.split('\n');
  let current = '';

  for (const line of lines) {
    if (current.length + line.length + 1 > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

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

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('Fetching current week summary...');
  const summary = await getCurrentWeekSummary();
  const post = formatShortPost(summary);

  console.log('\n--- Post content ---');
  console.log(post);
  console.log(`--- ${post.length} chars ---\n`);

  if (dryRun) {
    console.log('[DRY RUN] Would post to Bluesky. Skipping.');
    return;
  }

  console.log('Authenticating with Bluesky...');
  const session = await createSession();
  console.log(`Authenticated as ${process.env.BLUESKY_HANDLE}`);

  console.log('Creating post...');
  const uri = await createPost(session, post);
  console.log(`Posted successfully: ${uri}`);

  // Convert AT URI to web URL
  const handle = process.env.BLUESKY_HANDLE;
  const rkey = uri.split('/').pop();
  console.log(`View at: https://bsky.app/profile/${handle}/post/${rkey}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
