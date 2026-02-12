// ═══════════════════════════════════════════════════════════════
// GNews API Client — Free tier: 100 requests/day, 10 articles/request
// https://gnews.io/docs/v4
// ═══════════════════════════════════════════════════════════════

import type { ArticleInput } from './types';

const GNEWS_API = 'https://gnews.io/api/v4';

interface GNewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  image: string;
  publishedAt: string;
  source: {
    name: string;
    url: string;
  };
}

interface GNewsResponse {
  totalArticles: number;
  articles: GNewsArticle[];
}

/** Pre-defined search queries covering key topics */
const SEARCH_QUERIES = [
  'trump executive order',
  'DOJ lawsuit voting rights',
  'trump administration policy',
  'white house executive action',
  'trump congress legislation',
  'federal agency purge',
];

/**
 * Search GNews for articles matching a query.
 * Free tier: 100 requests/day, 10 articles per request.
 */
export async function searchGNews(params: {
  query: string;
  from?: string;     // ISO date
  to?: string;       // ISO date
  max?: number;
}): Promise<ArticleInput[]> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) {
    console.warn('GNEWS_API_KEY not set, skipping GNews');
    return [];
  }

  const { query, from, to, max = 10 } = params;

  const url = new URL(`${GNEWS_API}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('country', 'us');
  url.searchParams.set('max', String(max));
  url.searchParams.set('apikey', apiKey);

  if (from) url.searchParams.set('from', from);
  if (to) url.searchParams.set('to', to);

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    if (response.status === 429) {
      console.warn('GNews rate limit reached');
      return [];
    }
    throw new Error(`GNews API error: ${response.status} ${response.statusText}`);
  }

  const data: GNewsResponse = await response.json();
  return data.articles.map(normalizeGNewsArticle);
}

/**
 * Fetch recent articles across multiple search queries.
 * Uses ~6 of the 100 daily requests.
 */
export async function fetchGNewsRecent(): Promise<ArticleInput[]> {
  const results: ArticleInput[] = [];
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  for (const query of SEARCH_QUERIES) {
    try {
      const articles = await searchGNews({ query, from: sixHoursAgo });
      results.push(...articles);
    } catch (err) {
      console.error(`GNews query failed for "${query}":`, err);
    }
    // Small delay between requests to be respectful
    await new Promise((r) => setTimeout(r, 500));
  }

  return results;
}

/**
 * Fetch articles for a specific date range (used by backfill).
 * Limited to 2 queries to conserve daily quota.
 */
export async function fetchGNewsForDateRange(
  startDate: Date,
  endDate: Date,
): Promise<ArticleInput[]> {
  const results: ArticleInput[] = [];
  const from = startDate.toISOString().slice(0, 19) + 'Z';
  const to = endDate.toISOString().slice(0, 19) + 'Z';

  // Use only 2 broad queries for backfill to conserve quota
  const backfillQueries = [
    'trump administration',
    'DOJ executive order',
  ];

  for (const query of backfillQueries) {
    try {
      const articles = await searchGNews({ query, from, to });
      results.push(...articles);
    } catch (err) {
      console.error(`GNews backfill query failed for "${query}":`, err);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  return results;
}

function normalizeGNewsArticle(article: GNewsArticle): ArticleInput {
  return {
    url: article.url,
    headline: article.title || '',
    summary: article.description || undefined,
    publisher: article.source?.name || 'unknown',
    published_at: article.publishedAt || new Date().toISOString(),
    source: 'gnews',
  };
}
