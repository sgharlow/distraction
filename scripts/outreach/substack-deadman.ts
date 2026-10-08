/**
 * Substack weekly-publish dead-man check (run by .github/workflows/substack-deadman.yml).
 *
 * Reads the PUBLIC post listings of distractionindex.substack.com — no secrets,
 * no .env.local — and decides whether the week the Sunday cascade should have
 * published is there. Writes state/week/newest/reason to $GITHUB_OUTPUT when set,
 * and prints the verdict as one JSON line.
 *
 * Exit 0 = OK, 1 = MISSING or ERROR. Any crash inside main() is caught and written
 * as state=ERROR (fail-closed); a crash before main() writes nothing, and the
 * workflow treats a missing state as ERROR too.
 *
 * It ALERTS only. Never use it to decide to re-publish: the archive listing lags.
 *
 * Usage:
 *   npx tsx scripts/outreach/substack-deadman.ts
 *   npx tsx scripts/outreach/substack-deadman.ts --as-of 2026-10-12T15:00:00Z
 */
import { appendFileSync } from 'fs';
import {
  evaluate,
  expectedWeek,
  mergeListings,
  type ListingSource,
  type Verdict,
} from '../../src/lib/monitor/substack-deadman';

const SUBSTACK_URL = 'https://distractionindex.substack.com';

// /api/v1/archive is the public archive (lags: measured 2026-10-08 still at Week 63
// after Week 92 was live, even on a Cloudflare MISS); /api/v1/posts listed Week 92
// within minutes. Both are read and unioned, so a lag alone does not alert.
const LISTINGS: { source: string; url: string }[] = [
  { source: 'archive', url: `${SUBSTACK_URL}/api/v1/archive?sort=new&limit=12` },
  { source: 'posts', url: `${SUBSTACK_URL}/api/v1/posts?limit=12` },
];

async function fetchListing(source: string, url: string): Promise<ListingSource> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'distraction-index-substack-deadman/1.0' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { source, error: `HTTP ${res.status}` };
    return { source, body: await res.json() };
  } catch (err) {
    return { source, error: err instanceof Error ? err.message : String(err) };
  }
}

function parseAsOf(argv: string[]): Date {
  const i = argv.indexOf('--as-of');
  if (i === -1) return new Date();
  const raw = argv[i + 1];
  const d = new Date(raw ?? '');
  if (!raw || Number.isNaN(d.getTime())) throw new Error(`--as-of needs an ISO timestamp (got ${raw})`);
  return d;
}

function writeOutputs(v: { state: string; expected: number | null; newest: number | null; reason: string }) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  const oneLine = v.reason.replace(/[\r\n]+/g, ' ');
  appendFileSync(
    file,
    `state=${v.state}\nweek=${v.expected ?? ''}\nnewest=${v.newest ?? ''}\nreason=${oneLine}\n`,
  );
}

async function main(): Promise<Verdict> {
  const asOf = parseAsOf(process.argv.slice(2));
  const expected = expectedWeek(asOf);
  const sources = await Promise.all(LISTINGS.map((l) => fetchListing(l.source, l.url)));
  const { items, errors } = mergeListings(sources);
  const verdict = evaluate(items, expected);
  const reason = errors.length ? `${verdict.reason} [source errors: ${errors.join('; ')}]` : verdict.reason;
  return { ...verdict, reason: `as of ${asOf.toISOString()}: ${reason}` };
}

main()
  .then((v) => {
    writeOutputs(v);
    console.log(JSON.stringify(v));
    process.exit(v.state === 'OK' ? 0 : 1);
  })
  .catch((err) => {
    const reason = `check crashed: ${err instanceof Error ? err.message : String(err)}`;
    const v = { state: 'ERROR', expected: null, newest: null, reason };
    try {
      writeOutputs(v);
    } catch {
      // The workflow treats a missing state as ERROR, so a failed write still alerts.
    }
    console.error(JSON.stringify(v));
    process.exit(1);
  });
