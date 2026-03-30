/**
 * Follow relevant accounts on Bluesky and Mastodon.
 * One-time growth script for Day 7 of the outreach plan.
 *
 * Usage:
 *   npx tsx scripts/outreach/follow-accounts.ts --bluesky
 *   npx tsx scripts/outreach/follow-accounts.ts --mastodon
 *   npx tsx scripts/outreach/follow-accounts.ts --all
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../.env.local') });

const BLUESKY_TARGETS = [
  'aclu.bsky.social',
  'protectdemocracy.bsky.social',
  'brennancenter.bsky.social',
  'commoncause.bsky.social',
  'citizensforethics.bsky.social',
  'indivisibleteam.bsky.social',
  'moveon.bsky.social',
  'natesilver.bsky.social',
  'donlemon.bsky.social',
  'mehdirhasan.bsky.social',
  'joshtpm.bsky.social',
  'andrewfeinberg.bsky.social',
  'eff.bsky.social',
  'propublica.bsky.social',
  'themarkup.bsky.social',
  'opensecrets.bsky.social',
  'joycevance.bsky.social',
  'glennkirschner.bsky.social',
  'legaleagle.bsky.social',
  'laurencetribe.bsky.social',
  'democracydocket.bsky.social',
  'lawfareproject.bsky.social',
  'marcelias.bsky.social',
  'ruthbenghiat.bsky.social',
];

const MASTODON_TARGETS = [
  'eff@mastodon.social',
  'propublica@newsie.social',
  'brennancenter@mastodon.social',
  'aclu@mastodon.social',
  'themarkup@mastodon.social',
  'democracynow@mastodon.social',
  'meidastouch@mastodon.social',
  'rbreich@masto.ai',
  'heatherc@mastodon.social',
  'popehat@mas.to',
  'dangillmor@mastodon.social',
  'emilybell@mastodon.social',
  'w7voa@journa.host',
  'timbray@cosocial.ca',
  'evacide@hachyderm.io',
  'nancygroves@mastodon.social',
  'josh@mastodon.social',
  'mattblaze@federate.social',
  'doctorow@mamot.fr',
  'pluralistic@mamot.fr',
];

async function followOnBluesky() {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!handle || !password) { console.error('Missing BLUESKY creds'); return; }

  const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password }),
  });
  if (!sessionRes.ok) { console.error('Bluesky auth failed'); return; }
  const session = await sessionRes.json();
  const pds = session.didDoc?.service?.find((s: any) => s.id === '#atproto_pds')?.serviceEndpoint || 'https://bsky.social';
  console.log(`\n=== Bluesky: Authenticated as ${handle} ===\n`);

  let success = 0, already = 0, failed = 0;
  for (const target of BLUESKY_TARGETS) {
    try {
      const resolveRes = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${target}`);
      if (!resolveRes.ok) { console.log(`  SKIP: ${target} (not found)`); failed++; continue; }
      const { did } = await resolveRes.json();

      const followRes = await fetch(`${pds}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
        body: JSON.stringify({
          repo: session.did,
          collection: 'app.bsky.graph.follow',
          record: { $type: 'app.bsky.graph.follow', subject: did, createdAt: new Date().toISOString() },
        }),
      });

      if (followRes.ok) { console.log(`  OK: ${target}`); success++; }
      else {
        const err = await followRes.text();
        if (err.includes('duplicate') || err.includes('already')) { console.log(`  ALREADY: ${target}`); already++; }
        else { console.log(`  FAIL: ${target} — ${err.substring(0, 80)}`); failed++; }
      }
    } catch (e: any) { console.log(`  ERROR: ${target} — ${e.message.substring(0, 80)}`); failed++; }
  }
  console.log(`\nBluesky: ${success} new, ${already} already following, ${failed} failed`);
}

async function followOnMastodon() {
  const instance = process.env.MASTODON_INSTANCE;
  const token = process.env.MASTODON_ACCESS_TOKEN;
  if (!instance || !token) { console.error('Missing MASTODON creds'); return; }

  console.log(`\n=== Mastodon: ${instance} ===\n`);

  let success = 0, already = 0, failed = 0;
  for (const acct of MASTODON_TARGETS) {
    try {
      // Search for account
      const searchRes = await fetch(`${instance}/api/v2/search?q=${encodeURIComponent(acct)}&type=accounts&limit=1&resolve=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!searchRes.ok) { console.log(`  SKIP: ${acct} (search failed)`); failed++; continue; }
      const searchData = await searchRes.json();
      const accounts = searchData.accounts || [];
      if (accounts.length === 0) { console.log(`  SKIP: ${acct} (not found)`); failed++; continue; }

      const accountId = accounts[0].id;
      const isFollowing = accounts[0].following || false;

      // Follow
      const followRes = await fetch(`${instance}/api/v1/accounts/${accountId}/follow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (followRes.ok) {
        const result = await followRes.json();
        if (result.following) { console.log(`  OK: ${acct}`); success++; }
        else { console.log(`  PENDING: ${acct} (follow request sent)`); success++; }
      } else {
        console.log(`  FAIL: ${acct} — ${(await followRes.text()).substring(0, 80)}`);
        failed++;
      }
    } catch (e: any) { console.log(`  ERROR: ${acct} — ${e.message.substring(0, 80)}`); failed++; }
  }
  console.log(`\nMastodon: ${success} new/pending, ${already} already following, ${failed} failed`);
}

async function main() {
  const doBluesky = process.argv.includes('--bluesky') || process.argv.includes('--all');
  const doMastodon = process.argv.includes('--mastodon') || process.argv.includes('--all');

  if (!doBluesky && !doMastodon) {
    console.log('Usage: npx tsx follow-accounts.ts --bluesky | --mastodon | --all');
    return;
  }

  if (doBluesky) await followOnBluesky();
  if (doMastodon) await followOnMastodon();
}

main();
