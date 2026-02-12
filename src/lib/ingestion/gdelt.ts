// ═══════════════════════════════════════════════════════════════
// GDELT API Client — Free, comprehensive news archive
// https://api.gdeltproject.org/api/v2/doc/doc
// ═══════════════════════════════════════════════════════════════

import type { ArticleInput } from './types';

const GDELT_API = 'https://api.gdeltproject.org/api/v2/doc/doc';

/** GDELT article result */
interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;         // "20260208T123000Z"
  socialimage: string;
  domain: string;
  language: string;
  sourcecountry: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

/**
 * Search GDELT for recent US political news articles.
 *
 * @param query - Search terms
 * @param startDate - Start of date range (YYYYMMDDHHMMSS)
 * @param endDate - End of date range (YYYYMMDDHHMMSS)
 * @param maxRecords - Max articles to return (default 100)
 */
export async function searchGdelt(params: {
  query?: string;
  startDate?: string;
  endDate?: string;
  maxRecords?: number;
}): Promise<ArticleInput[]> {
  const {
    query = '(trump OR "executive order" OR DOJ OR "white house" OR congress) sourcelang:english sourcecountry:US',
    startDate,
    endDate,
    maxRecords = 100,
  } = params;

  const url = new URL(GDELT_API);
  url.searchParams.set('query', query);
  url.searchParams.set('mode', 'artlist');
  url.searchParams.set('format', 'json');
  url.searchParams.set('maxrecords', String(maxRecords));
  url.searchParams.set('sort', 'datedesc');

  if (startDate) url.searchParams.set('startdatetime', startDate);
  if (endDate) url.searchParams.set('enddatetime', endDate);

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`GDELT API error: ${response.status} ${response.statusText}`);
  }

  const data: GdeltResponse = await response.json();

  if (!data.articles || data.articles.length === 0) {
    return [];
  }

  return data.articles.map(normalizeGdeltArticle);
}

/**
 * Fetch articles for a specific date range (used by backfill).
 * GDELT date format: YYYYMMDDHHMMSS
 */
export async function fetchGdeltForDateRange(
  startDate: Date,
  endDate: Date,
  maxRecords = 250,
): Promise<ArticleInput[]> {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:T]/g, '').slice(0, 14);

  return searchGdelt({
    startDate: fmt(startDate),
    endDate: fmt(endDate),
    maxRecords,
  });
}

/**
 * Fetch recent articles (last N hours) for daily ingestion.
 */
export async function fetchGdeltRecent(hoursBack = 6): Promise<ArticleInput[]> {
  const end = new Date();
  const start = new Date(end.getTime() - hoursBack * 60 * 60 * 1000);
  return fetchGdeltForDateRange(start, end, 100);
}

function normalizeGdeltArticle(article: GdeltArticle): ArticleInput {
  // Parse GDELT date format: "20260208T123000Z"
  let publishedAt: string;
  try {
    const s = article.seendate;
    const dateStr = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`;
    publishedAt = new Date(dateStr).toISOString();
  } catch {
    publishedAt = new Date().toISOString();
  }

  return {
    url: article.url,
    headline: article.title || '',
    publisher: article.domain || 'unknown',
    published_at: publishedAt,
    source: 'gdelt',
  };
}
