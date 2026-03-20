/**
 * Post to Twitter/X using the v2 API (OAuth 1.0a User Context).
 *
 * X API v2 free tier: 1,500 tweets/month (~50/day, plenty for 3x/day).
 *
 * Setup:
 *   1. Apply for X Developer account: https://developer.x.com/
 *   2. Create a project + app with Read and Write permissions
 *   3. Generate OAuth 1.0a keys (API Key, API Secret, Access Token, Access Token Secret)
 *   4. Add to .env.local:
 *      TWITTER_API_KEY=your_api_key
 *      TWITTER_API_SECRET=your_api_secret
 *      TWITTER_ACCESS_TOKEN=your_access_token
 *      TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret
 *
 * Usage:
 *   npx tsx scripts/outreach/twitter-post.ts [--dry-run] [--slot morning|midday|evening]
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { createHmac, randomBytes } from 'crypto';
import { generatePost, type PostSlot } from './content-variants';

config({ path: resolve(__dirname, '../../.env.local') });

// ---------------------------------------------------------------------------
// OAuth 1.0a signature generation
// ---------------------------------------------------------------------------
function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string,
): string {
  // Sort params alphabetically and encode
  const sortedParams = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join('&');

  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(sortedParams)].join('&');
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;

  return createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function buildAuthHeader(
  method: string,
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string,
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const signature = generateOAuthSignature(method, url, oauthParams, apiSecret, accessTokenSecret);
  oauthParams['oauth_signature'] = signature;

  const headerParts = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

// ---------------------------------------------------------------------------
// Post to X/Twitter
// ---------------------------------------------------------------------------
const TWEET_ENDPOINT = 'https://api.x.com/2/tweets';

async function postTweet(text: string): Promise<{ success: boolean; error?: string; tweetId?: string }> {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    return {
      success: false,
      error: 'Missing Twitter/X credentials. Add TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET to .env.local',
    };
  }

  try {
    // X enforces 280 char limit
    const tweetText = text.length > 280 ? text.substring(0, 277) + '...' : text;

    const authHeader = buildAuthHeader('POST', TWEET_ENDPOINT, apiKey, apiSecret, accessToken, accessTokenSecret);

    const res = await fetch(TWEET_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ text: tweetText }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Tweet failed: ${res.status} ${err.substring(0, 200)}` };
    }

    const data = await res.json();
    return { success: true, tweetId: data.data?.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// Thread support: split long content into tweet threads
// ---------------------------------------------------------------------------
function splitIntoTweets(text: string, maxLen = 275): string[] {
  if (text.length <= maxLen) return [text];

  const tweets: string[] = [];
  const lines = text.split('\n');
  let current = '';

  for (const line of lines) {
    if (current.length + line.length + 1 > maxLen && current.length > 0) {
      tweets.push(current.trim());
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current.trim()) tweets.push(current.trim());
  return tweets;
}

async function postThread(text: string): Promise<{ success: boolean; error?: string; tweetIds?: string[] }> {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    return { success: false, error: 'Missing Twitter/X credentials' };
  }

  const tweets = splitIntoTweets(text);
  const tweetIds: string[] = [];
  let replyToId: string | undefined;

  for (let i = 0; i < tweets.length; i++) {
    const tweetText = tweets.length > 1 && i < tweets.length - 1 ? tweets[i] + ' 🧵' : tweets[i];

    try {
      const authHeader = buildAuthHeader('POST', TWEET_ENDPOINT, apiKey, apiSecret, accessToken, accessTokenSecret);

      const body: Record<string, unknown> = { text: tweetText };
      if (replyToId) {
        body.reply = { in_reply_to_tweet_id: replyToId };
      }

      const res = await fetch(TWEET_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Tweet ${i + 1}/${tweets.length} failed: ${res.status} ${err.substring(0, 200)}`, tweetIds };
      }

      const data = await res.json();
      const id = data.data?.id;
      if (id) {
        tweetIds.push(id);
        replyToId = id;
      }
    } catch (e: any) {
      return { success: false, error: `Tweet ${i + 1} error: ${e.message}`, tweetIds };
    }
  }

  return { success: true, tweetIds };
}

// ---------------------------------------------------------------------------
// Export for scheduler integration
// ---------------------------------------------------------------------------
export async function postToTwitter(text: string): Promise<{ success: boolean; error?: string }> {
  // Check if credentials exist
  if (!process.env.TWITTER_API_KEY) {
    return { success: false, error: 'Twitter/X not configured (no TWITTER_API_KEY)' };
  }

  // Use thread if text > 280 chars, otherwise single tweet
  if (text.length > 280) {
    const result = await postThread(text);
    return { success: result.success, error: result.error };
  }

  return postTweet(text);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const slotArg = process.argv.find(a => a.startsWith('--slot='));
  const slot = (slotArg?.split('=')[1] || 'midday') as PostSlot;

  if (!['morning', 'midday', 'evening'].includes(slot)) {
    console.log('Usage: npx tsx scripts/outreach/twitter-post.ts [--dry-run] [--slot=morning|midday|evening]');
    process.exit(1);
  }

  console.log('Generating post content...');
  const post = await generatePost(slot);

  console.log(`\n--- Twitter/X post (${post.variant}) ---`);
  console.log(post.text);
  console.log(`--- ${post.text.length} chars ---\n`);

  if (dryRun) {
    console.log('[DRY RUN] Would post to Twitter/X.');
    if (post.text.length > 280) {
      const tweets = splitIntoTweets(post.text);
      console.log(`Would create thread: ${tweets.length} tweets`);
      tweets.forEach((t, i) => console.log(`  [${i + 1}] ${t.substring(0, 80)}... (${t.length} chars)`));
    }
    return;
  }

  const result = await postToTwitter(post.text);
  if (result.success) {
    console.log('SUCCESS — Posted to Twitter/X');
  } else {
    console.error(`FAILED: ${result.error}`);
    process.exit(1);
  }
}

// Only run CLI when executed directly, not when imported by scheduler
const isDirectRun = process.argv[1]?.includes('twitter-post');
if (isDirectRun) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
