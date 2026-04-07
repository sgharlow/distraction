/**
 * One-off announcement: Magazine editorial retheme.
 * Posts to Bluesky + Mastodon about the new UI.
 *
 * Usage:
 *   npx tsx scripts/outreach/announce-retheme.ts [--dry-run]
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../.env.local') });

const POST_TEXT = `We just redesigned distractionindex.org from the ground up.

Magazine editorial layout — serif typography, clean dividers, scores that only highlight when they matter, and a pull-quote hero showing the week's smokescreen at a glance.

Same data, same algorithm, same transparency. Now it reads like a newspaper, not a dashboard.

Take a look and tell us what you think:
https://distractionindex.org/week/current

#DistractionIndex #CivicTech #OpenSource`;

// --- Bluesky ---

async function postToBluesky(text: string): Promise<void> {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!handle || !password) {
    console.log('[Bluesky] Skipping — missing credentials');
    return;
  }

  const authRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password }),
  });
  if (!authRes.ok) throw new Error(`Bluesky auth failed: ${authRes.status}`);
  const session = await authRes.json();

  // Detect URL facets
  const urlRegex = /https?:\/\/[^\s)]+/g;
  const facets: any[] = [];
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const byteStart = new TextEncoder().encode(text.slice(0, match.index)).length;
    const byteEnd = byteStart + new TextEncoder().encode(match[0]).length;
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: match[0] }],
    });
  }

  // Detect hashtag facets
  const hashtagRegex = /#(\w+)/g;
  while ((match = hashtagRegex.exec(text)) !== null) {
    const byteStart = new TextEncoder().encode(text.slice(0, match.index)).length;
    const byteEnd = byteStart + new TextEncoder().encode(match[0]).length;
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: match[1] }],
    });
  }

  // Split into thread chunks if needed (Bluesky 300 grapheme limit)
  const chunks = splitChunks(text, 290);
  let parentRef: any = null;
  let rootRef: any = null;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = i < chunks.length - 1 ? chunks[i] + ' (1/' + chunks.length + ')' : chunks[i];

    // Recalculate facets for this chunk
    const chunkFacets: any[] = [];
    const chunkUrlRegex = /https?:\/\/[^\s)]+/g;
    let m;
    while ((m = chunkUrlRegex.exec(chunk)) !== null) {
      const bs = new TextEncoder().encode(chunk.slice(0, m.index)).length;
      const be = bs + new TextEncoder().encode(m[0]).length;
      chunkFacets.push({
        index: { byteStart: bs, byteEnd: be },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }],
      });
    }
    const chunkHashRegex = /#(\w+)/g;
    while ((m = chunkHashRegex.exec(chunk)) !== null) {
      const bs = new TextEncoder().encode(chunk.slice(0, m.index)).length;
      const be = bs + new TextEncoder().encode(m[0]).length;
      chunkFacets.push({
        index: { byteStart: bs, byteEnd: be },
        features: [{ $type: 'app.bsky.richtext.facet#tag', tag: m[1] }],
      });
    }

    const record: any = {
      $type: 'app.bsky.feed.post',
      text: chunk,
      createdAt: new Date().toISOString(),
      langs: ['en'],
    };
    if (chunkFacets.length > 0) record.facets = chunkFacets;
    if (parentRef) record.reply = { root: rootRef, parent: parentRef };

    const pdsEndpoint = session.didDoc?.service?.[0]?.serviceEndpoint || 'https://bsky.social';
    const postRes = await fetch(`${pdsEndpoint}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: 'app.bsky.feed.post',
        record,
      }),
    });
    if (!postRes.ok) throw new Error(`Bluesky post failed: ${postRes.status} ${await postRes.text()}`);
    const result = await postRes.json();

    if (i === 0) {
      rootRef = { uri: result.uri, cid: result.cid };
    }
    parentRef = { uri: result.uri, cid: result.cid };
  }
  console.log('[Bluesky] Posted successfully');
}

// --- Mastodon ---

async function postToMastodon(text: string): Promise<void> {
  const instance = process.env.MASTODON_INSTANCE;
  const token = process.env.MASTODON_ACCESS_TOKEN;
  if (!instance || !token) {
    console.log('[Mastodon] Skipping — missing credentials');
    return;
  }

  const base = instance.startsWith('http') ? instance : `https://${instance}`;
  const res = await fetch(`${base}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status: text, visibility: 'public' }),
  });
  if (!res.ok) throw new Error(`Mastodon post failed: ${res.status} ${await res.text()}`);
  console.log('[Mastodon] Posted successfully');
}

// --- Helpers ---

function splitChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  const sentences = text.split('\n\n');
  let current = '';
  for (const sentence of sentences) {
    if ((current + '\n\n' + sentence).trim().length > maxLen && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + '\n\n' + sentence : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// --- Main ---

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('=== Distraction Index — New UI Announcement ===\n');
  console.log(POST_TEXT);
  console.log(`\n--- ${POST_TEXT.length} chars ---\n`);

  if (dryRun) {
    console.log('[DRY RUN] Would post to Bluesky and Mastodon. Skipping.');
    return;
  }

  const results: string[] = [];

  try {
    await postToBluesky(POST_TEXT);
    results.push('Bluesky: OK');
  } catch (e) {
    console.error('[Bluesky] Error:', e);
    results.push('Bluesky: FAILED');
  }

  try {
    await postToMastodon(POST_TEXT);
    results.push('Mastodon: OK');
  } catch (e) {
    console.error('[Mastodon] Error:', e);
    results.push('Mastodon: FAILED');
  }

  console.log('\n=== Results ===');
  results.forEach(r => console.log(r));
}

main().catch(console.error);
