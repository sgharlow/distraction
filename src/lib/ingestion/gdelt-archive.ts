/**
 * GDELT raw-archive reader — a throttle-free alternate path to GDELT data.
 *
 * WHY THIS EXISTS
 * The GDELT DOC API (used by the normal backfill) applies a multi-hour burst
 * cooldown that left week 2026-07-19 stuck at 4/7 days. The raw 15-minute file
 * archive at data.gdeltproject.org is a static CDN with NO observed rate limiter
 * (96/96 windows fetched in ~200-400ms each while the DOC API was 429ing). This
 * module reconstructs the same {url, title, date, domain} article shape the
 * backfill works in, from the archive, so a day the DOC API refuses can still be
 * filled.
 *
 * WHICH FILE, AND WHY NOT THE OBVIOUS ONE
 * The archive has three files per window. `export`/`mentions` are event-coded and
 * carry URLs but NO article titles — and the backfill's dedup requires
 * title.length >= 15 and clusters on titles, so those files are unusable. The GKG
 * file's `V2EXTRAS` XML carries `<PAGE_TITLE>` for ~100% of rows. This was verified
 * against real data before building (see the git history for the investigation).
 *
 * COMPARABILITY — THE LOAD-BEARING CONSTRAINT
 * A backfilled week must be built from the same corpus by the same method as every
 * other frozen week, or the frozen time series has a methodological discontinuity
 * that reads like a real signal. Two facts, both measured against the DOC API for
 * the same day (2026-07-19):
 *   1. Raw GKG is a GLOBAL firehose — its head is foreign/aggregator outlets
 *      (aninews.in, timesofindia, aljazeera) that the DOC API's `sourcecountry:US`
 *      excludes. So GKG MUST be US-filtered. After filtering, the source_type
 *      distribution classifySource() produces matches the DOC API (98-99% null).
 *   2. GKG sees far more per day (~1400 US-politics rows) than the DOC API's 250
 *      datedesc cap. So it MUST be capped to a DOC-comparable volume, newest-first,
 *      or a GKG day would carry 5x the articles of a DOC day in the same week.
 * Both are enforced here. Without them this would be the GNews mistake in reverse —
 * a differently-composed source silently distorting a permanent snapshot.
 */

import { inflateRawSync } from 'zlib';
import type { CachedArticle } from './day-cache';

const ARCHIVE_BASE = 'http://data.gdeltproject.org/gdeltv2';

/** GKG 2.1 tab-delimited column indices (0-based). */
const COL_DOMAIN = 3; // V2SourceCommonName
const COL_URL = 4; // V2DocumentIdentifier
const COL_TRANSLATION = 25; // V21TranslationInfo — non-empty => machine-translated (non-English)

/** Minimum title length the backfill's dedup requires. */
export const MIN_TITLE_LEN = 15;

/**
 * DOC-comparable per-day cap. The DOC API returns up to 250 records/day sorted
 * newest-first; matching that keeps a GKG-sourced day the same size as the DOC
 * days it sits beside in a week.
 */
export const DEFAULT_DAY_CAP = 250;

/**
 * US-politics title filter, aligned with the DOC API backfill query terms
 * (trump / executive order / DOJ / white house / congress / supreme court),
 * widened slightly with the institutions that query implies. Matched against the
 * title only — GKG carries no article body — so this is a high-precision subset
 * of what the DOC API's full-text match would return, which is the safe direction.
 */
export const US_POLITICS_TITLE = /\b(trump|executive order|doj|white house|congress|supreme court|senate|scotus|federal reserve|administration|white\s?house)\b/i;

/**
 * ccTLDs to drop as the first half of a pragmatic sourcecountry:US approximation.
 * Natively-English foreign outlets carry no translation flag, so language detection
 * alone does not exclude them — the TLD does. This catches aninews.in, bbc.co.uk,
 * abc.net.au, etc.
 */
const FOREIGN_TLD = /\.(in|co\.uk|uk|pk|ng|eg|au|ca|ie|za|ph|sg|nz|lk|bd|np|qa|ae|il|ru|cn|jp|kr|de|fr|es|it|nl|se|no|dk|fi|gr|tr|mx|br|ar|cl|co)$/i;

/**
 * The second half: the high-volume English-language FOREIGN outlets that publish on
 * generic .com/.net/.org TLDs, which the ccTLD filter cannot see. GDELT's global
 * firehead is dominated by these (verified in the pre-build probe — timesofindia,
 * aljazeera led the raw head), and the DOC API's sourcecountry:US excludes every
 * one. A host is dropped if it equals or is a subdomain of any entry (endsWith on a
 * dotted boundary), so economictimes.indiatimes.com is caught by indiatimes.com.
 * NOT exhaustive — a best-effort denylist; extend it when a new foreign .com outlet
 * appears in a backfilled day. Erring toward dropping a borderline outlet keeps the
 * corpus comparable to the DOC-API weeks, which is the safe direction.
 */
const FOREIGN_DOMAINS = new Set([
  // India (largest foreign contributor to the GKG US-politics firehose)
  'indiatimes.com', 'thehindu.com', 'ndtv.com', 'hindustantimes.com',
  'indianexpress.com', 'news18.com', 'firstpost.com', 'livemint.com',
  'business-standard.com', 'republicworld.com', 'wionews.com', 'oneindia.com',
  'deccanherald.com', 'thewire.in', 'scroll.in', 'theprint.in',
  // Middle East
  'aljazeera.com', 'arabnews.com', 'gulfnews.com', 'thenationalnews.com',
  'middleeasteye.net', 'jpost.com', 'timesofisrael.com',
  // UK / Ireland on generic TLDs
  'theguardian.com', 'bbc.com', 'reuters.com', 'dailymail.com', 'thesun.com',
  'irishtimes.com', 'rte.com',
  // Russia / China state & English outlets
  'rt.com', 'sputniknews.com', 'sputnikglobe.com', 'tass.com', 'cgtn.com',
  'scmp.com', 'xinhuanet.com', 'globaltimes.cn',
  // Canada / Australia / Asia-Pacific on generic TLDs
  'theglobeandmail.com', 'nationalpost.com', 'straitstimes.com',
  'channelnewsasia.com', 'scmp.com',
  // Europe English editions
  'dw.com', 'france24.com', 'euronews.com', 'politico.eu',
  // Africa / Latin America English outlets on generic TLDs (surfaced in the
  // 2026-07-19 validation probe against the DOC-API day)
  'el-balad.com', 'cubaheadlines.com', 'egypttoday.com', 'ahram.org.eg',
]);

/** True if host equals or is a subdomain of a denylisted foreign outlet. */
function isForeignDomain(host: string): boolean {
  if (FOREIGN_DOMAINS.has(host)) return true;
  for (const d of FOREIGN_DOMAINS) {
    if (host.endsWith('.' + d)) return true;
  }
  return false;
}

export interface ParsedGkgRow {
  url: string;
  title: string;
  domain: string;
  translated: boolean;
}

/**
 * Decode a GDELT .zip (exactly one deflate-compressed file) with Node's built-in
 * zlib — no third-party zip dependency. Reads the local file header, then inflates
 * the payload (or slices raw bytes for a stored/uncompressed entry).
 */
export function unzipSingle(buf: Buffer): string {
  if (buf.length < 30 || buf.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('not a zip local file header');
  }
  const method = buf.readUInt16LE(8);
  const compSize = buf.readUInt32LE(18);
  const nameLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const dataStart = 30 + nameLen + extraLen;

  let comp: Buffer;
  if (compSize > 0) {
    comp = buf.subarray(dataStart, dataStart + compSize);
  } else {
    // Streamed entry with a data descriptor: slice up to the central directory.
    const cd = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), dataStart);
    comp = buf.subarray(dataStart, cd === -1 ? undefined : cd);
  }
  // method 0 = stored, 8 = deflate.
  return method === 0 ? comp.toString('utf8') : inflateRawSync(comp).toString('utf8');
}

/** The 96 fifteen-minute window stamps (YYYYMMDDHHMMSS) of a UTC day. */
export function gkgWindowStamps(dayKey: string): string[] {
  const ymd = dayKey.replace(/-/g, '');
  const stamps: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of ['0000', '1500', '3000', '4500']) {
      stamps.push(`${ymd}${String(h).padStart(2, '0')}${m}`);
    }
  }
  return stamps;
}

/** Parse one GKG line into url/title/domain/translated, or null if unusable. */
export function parseGkgLine(line: string): ParsedGkgRow | null {
  if (!line) return null;
  const c = line.split('\t');
  const url = c[COL_URL] || '';
  if (!url.startsWith('http')) return null;

  const extras = c[c.length - 1] || '';
  const tm = extras.match(/<PAGE_TITLE>(.*?)<\/PAGE_TITLE>/);
  const title = tm ? tm[1].trim() : '';

  let domain = (c[COL_DOMAIN] || '').replace(/^www\./, '');
  if (!domain) {
    try {
      domain = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  const translated = (c[COL_TRANSLATION] || '').includes('srclc');
  return { url, title, domain, translated };
}

/** URL hostname (www-stripped), or '' if unparseable. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Does a parsed row belong in a US-politics backfill day?
 * English (untranslated) + titled + keyword-matched + non-foreign TLD.
 */
export function isUsPolitics(
  row: ParsedGkgRow,
  keyword: RegExp = US_POLITICS_TITLE,
): boolean {
  if (row.translated) return false;
  if (row.title.length < MIN_TITLE_LEN) return false;
  if (!keyword.test(row.title)) return false;
  const host = hostOf(row.url) || row.domain;
  if (FOREIGN_TLD.test(host)) return false;
  if (isForeignDomain(host)) return false;
  return true;
}

/** Normalized URL key for dedup (matches the backfill's own dedup rule). */
export function normUrl(url: string): string {
  return url.replace(/\?.*$/, '').replace(/\/$/, '').toLowerCase();
}

/**
 * Turn window-tagged parsed rows into capped, deduped CachedArticles for a day.
 * Rows arrive newest-window-first; dedup keeps the first (newest) occurrence, then
 * the list is capped to `cap` to match the DOC API's datedesc volume.
 */
export function buildDayArticles(
  rows: ParsedGkgRow[],
  dayKey: string,
  cap: number = DEFAULT_DAY_CAP,
  keyword: RegExp = US_POLITICS_TITLE,
): CachedArticle[] {
  const seen = new Set<string>();
  const out: CachedArticle[] = [];
  for (const row of rows) {
    if (!isUsPolitics(row, keyword)) continue;
    const key = normUrl(row.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url: row.url, title: row.title, date: dayKey, domain: hostOf(row.url) || row.domain });
    if (out.length >= cap) break;
  }
  return out;
}

export interface GkgDayResult {
  articles: CachedArticle[];
  windowsFetched: number;
  windowsTotal: number;
}

/**
 * Fetch and reconstruct one UTC day from the GKG archive: US-politics-filtered,
 * deduped, and capped to DOC-comparable volume. Windows are fetched newest-first
 * so the cap keeps the most recent articles (matching the DOC API's datedesc).
 * A missing/failed window is skipped, not fatal — the archive occasionally lacks
 * a window. `windowsFetched` lets the caller judge day completeness.
 */
export async function fetchGkgDay(
  dayKey: string,
  opts: {
    cap?: number;
    keyword?: RegExp;
    fetchImpl?: typeof fetch;
    concurrency?: number;
  } = {},
): Promise<GkgDayResult> {
  const cap = opts.cap ?? DEFAULT_DAY_CAP;
  const keyword = opts.keyword ?? US_POLITICS_TITLE;
  const doFetch = opts.fetchImpl ?? fetch;
  const stamps = gkgWindowStamps(dayKey).reverse(); // newest window first

  const rows: ParsedGkgRow[] = [];
  let windowsFetched = 0;

  for (const stamp of stamps) {
    try {
      const resp = await doFetch(`${ARCHIVE_BASE}/${stamp}.gkg.csv.zip`, {
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) continue;
      const buf = Buffer.from(await resp.arrayBuffer());
      const csv = unzipSingle(buf);
      windowsFetched++;
      for (const line of csv.split('\n')) {
        const row = parseGkgLine(line);
        if (row) rows.push(row);
      }
    } catch {
      // Missing window or transient CDN error — skip and continue.
      continue;
    }
  }

  return {
    articles: buildDayArticles(rows, dayKey, cap, keyword),
    windowsFetched,
    windowsTotal: stamps.length,
  };
}
