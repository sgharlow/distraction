/**
 * Re-fetch Historical Articles
 *
 * For each frozen week that was capped at 200 articles by the old backfill,
 * re-fetches from GDELT without the cap, inserts missing articles, classifies
 * source_type, links new articles to existing events, and recomputes week stats.
 *
 * No Claude API calls. No event re-scoring. Just fills in the missing articles.
 *
 * Usage:
 *   npx tsx scripts/refetch-historical-articles.ts              # dry-run
 *   npx tsx scripts/refetch-historical-articles.ts --execute     # actually update
 *   npx tsx scripts/refetch-historical-articles.ts --execute --week 2025-01-05
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import { addDays, format } from 'date-fns';
import { classifySource } from '../src/lib/ingestion/classify-source';

const __dirname_resolved = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.resolve(__dirname_resolved, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'distraction' },
});

const EXECUTE = process.argv.includes('--execute');
const SINGLE_WEEK = (() => {
  const idx = process.argv.indexOf('--week');
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
})();

// ── Token similarity for linking articles to events ──
function tokenSimilarity(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  if (la.length === 0 || lb.length === 0) return 0;

  const tokensA = new Set(la.split(/\s+/).filter((t) => t.length > 2));
  const tokensB = new Set(lb.split(/\s+/).filter((t) => t.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

// ── GDELT fetch with retry/rate-limit handling ──
async function fetchGdeltForWeek(
  weekStart: Date,
  weekEnd: Date,
): Promise<Array<{ url: string; title: string; date: string; domain: string }>> {
  const fmtDt = (d: Date) => format(d, 'yyyyMMdd') + '000000';

  const query =
    '(trump OR "executive order" OR DOJ OR "white house" OR congress OR "supreme court") sourcelang:english sourcecountry:US';
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&format=json&maxrecords=250&startdatetime=${fmtDt(weekStart)}&enddatetime=${fmtDt(addDays(weekEnd, 1))}&sort=datedesc`;

  const MAX_RETRIES = 4;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let resp: Response;
    try {
      resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
    } catch (fetchErr) {
      // Network-level error (SSL, DNS, etc.)
      if (attempt < MAX_RETRIES) {
        const wait = attempt * 8;
        console.log(`  Network error, retrying in ${wait}s (attempt ${attempt}/${MAX_RETRIES})...`);
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      throw fetchErr;
    }

    // HTTP 429 rate limit
    if (resp.status === 429) {
      if (attempt < MAX_RETRIES) {
        const wait = attempt * 8;
        console.log(`  GDELT 429 rate limited, waiting ${wait}s (attempt ${attempt}/${MAX_RETRIES})...`);
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      throw new Error('GDELT rate limited (429) after max retries');
    }

    if (!resp.ok) throw new Error(`GDELT error: ${resp.status}`);

    const text = await resp.text();

    // Text-based rate limit response
    if (text.startsWith('Please limit')) {
      if (attempt < MAX_RETRIES) {
        const wait = attempt * 8;
        console.log(`  GDELT rate limited, waiting ${wait}s (attempt ${attempt}/${MAX_RETRIES})...`);
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      throw new Error('GDELT rate limited after max retries');
    }

    const data = JSON.parse(text);
    return (data.articles || []).map((a: any) => ({
      url: a.url,
      title: a.title || '',
      date: a.seendate
        ? `${a.seendate.slice(0, 4)}-${a.seendate.slice(4, 6)}-${a.seendate.slice(6, 8)}`
        : format(weekStart, 'yyyy-MM-dd'),
      domain: a.domain || 'unknown',
    }));
  }

  throw new Error('GDELT fetch failed after retries');
}

function deduplicateArticles(
  articles: Array<{ url: string; title: string; date: string; domain: string }>,
): Array<{ url: string; title: string; date: string; domain: string }> {
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (!a.title || a.title.length < 15) return false;
    const normUrl = a.url.replace(/\?.*$/, '').replace(/\/$/, '').toLowerCase();
    if (seen.has(normUrl)) return false;
    seen.add(normUrl);
    return true;
  });
}

// ── Link an article to the best-matching event in that week ──
async function linkArticleToEvent(
  articleUrl: string,
  articleHeadline: string,
  weekEvents: Array<{ id: string; title: string; article_count: number }>,
): Promise<{ eventId: string; eventTitle: string } | null> {
  let bestMatch: { id: string; title: string; score: number; article_count: number } | null = null;

  for (const event of weekEvents) {
    const sim = tokenSimilarity(articleHeadline, event.title);
    if (sim >= 0.4 && (!bestMatch || sim > bestMatch.score)) {
      bestMatch = { id: event.id, title: event.title, score: sim, article_count: event.article_count };
    }
  }

  return bestMatch ? { eventId: bestMatch.id, eventTitle: bestMatch.title } : null;
}

async function main() {
  console.log(`\nRe-fetch Historical Articles — ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}\n`);

  // Find weeks with exactly 200 articles (the capped ones)
  let query = supabase
    .from('weekly_snapshots')
    .select('week_id, status, total_sources')
    .eq('total_sources', 200);

  if (SINGLE_WEEK) {
    query = query.eq('week_id', SINGLE_WEEK);
  }

  const { data: cappedWeeks, error } = await query.order('week_id');

  if (error) {
    console.error(`Query error: ${error.message}`);
    process.exit(1);
  }

  if (!cappedWeeks || cappedWeeks.length === 0) {
    console.log('No weeks with exactly 200 articles found.');
    return;
  }

  console.log(`Found ${cappedWeeks.length} weeks with exactly 200 articles:\n`);

  const totals = { weeks: 0, fetched: 0, newInserted: 0, linked: 0, errors: 0 };

  for (const week of cappedWeeks) {
    const weekStart = new Date(week.week_id + 'T00:00:00');
    const weekEnd = addDays(weekStart, 6);
    const label = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;

    console.log(`── ${week.week_id} (${label}) ──`);

    // Fetch from GDELT
    let articles: Array<{ url: string; title: string; date: string; domain: string }>;
    try {
      const raw = await fetchGdeltForWeek(weekStart, weekEnd);
      articles = deduplicateArticles(raw);
      console.log(`  GDELT: ${raw.length} raw → ${articles.length} after dedup`);
    } catch (err) {
      console.error(`  GDELT fetch failed: ${err}`);
      totals.errors++;
      continue;
    }

    totals.fetched += articles.length;

    // Get existing article URLs for this week
    const { data: existingArticles } = await supabase
      .from('articles')
      .select('url')
      .eq('week_id', week.week_id);

    const existingUrls = new Set((existingArticles || []).map((a) => a.url));
    const newArticles = articles.filter((a) => !existingUrls.has(a.url));

    console.log(`  Existing: ${existingUrls.size}, New to insert: ${newArticles.length}`);

    if (newArticles.length === 0) {
      console.log(`  No new articles to add.`);
      totals.weeks++;
      continue;
    }

    // Get events for this week (for linking)
    const { data: weekEvents } = await supabase
      .from('events')
      .select('id, title, article_count')
      .eq('week_id', week.week_id);

    const events = weekEvents || [];

    if (EXECUTE) {
      // Insert new articles with source_type
      const articleInserts = newArticles.map((a) => ({
        url: a.url,
        headline: a.title,
        publisher: a.domain,
        published_at: `${a.date}T12:00:00Z`,
        week_id: week.week_id,
        ingestion_source: 'gdelt' as const,
        source_type: classifySource(a.url, a.domain),
      }));

      const { data: inserted, error: insertError } = await supabase
        .from('articles')
        .upsert(articleInserts, { onConflict: 'url', ignoreDuplicates: true })
        .select('id, url, headline');

      if (insertError) {
        console.error(`  Insert error: ${insertError.message}`);
        totals.errors++;
        continue;
      }

      const insertedCount = inserted?.length ?? 0;
      totals.newInserted += insertedCount;
      console.log(`  Inserted: ${insertedCount} articles`);

      // Link new articles to events
      let linkedCount = 0;
      const eventArticleDeltas = new Map<string, number>();

      for (const article of (inserted || [])) {
        const match = await linkArticleToEvent(article.url, article.headline, events);
        if (match) {
          await supabase
            .from('articles')
            .update({ event_id: match.eventId })
            .eq('id', article.id);

          const prev = eventArticleDeltas.get(match.eventId) || 0;
          eventArticleDeltas.set(match.eventId, prev + 1);
          linkedCount++;
        }
      }

      // Update article_count on events that got new articles
      for (const [eventId, delta] of eventArticleDeltas) {
        const event = events.find((e) => e.id === eventId);
        if (event) {
          await supabase
            .from('events')
            .update({ article_count: event.article_count + delta })
            .eq('id', eventId);
        }
      }

      totals.linked += linkedCount;
      console.log(`  Linked: ${linkedCount} articles to ${eventArticleDeltas.size} events`);

      // Recompute week stats
      await supabase.rpc('compute_week_stats', { target_week_id: week.week_id });
      console.log(`  Stats recomputed.`);
    } else {
      // Dry run: show what would happen
      let wouldLink = 0;
      for (const article of newArticles) {
        const match = await linkArticleToEvent(article.url, article.title, events);
        if (match) wouldLink++;
      }
      console.log(`  Would insert ${newArticles.length} articles, link ~${wouldLink} to events`);
      totals.newInserted += newArticles.length;
      totals.linked += wouldLink;
    }

    totals.weeks++;

    // Rate limit: 6s between weeks to respect GDELT's 1-per-5s limit
    await new Promise((r) => setTimeout(r, 6000));
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log('SUMMARY');
  console.log(`  Weeks processed:   ${totals.weeks}`);
  console.log(`  Articles fetched:  ${totals.fetched}`);
  console.log(`  New inserted:      ${totals.newInserted}`);
  console.log(`  Linked to events:  ${totals.linked}`);
  console.log(`  Errors:            ${totals.errors}`);

  if (!EXECUTE) {
    console.log('\nDry run complete. Run with --execute to apply changes.');
  } else {
    console.log('\nDone. Article counts are now variable across weeks.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
