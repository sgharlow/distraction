// ═══════════════════════════════════════════════════════════════
// Google News RSS Parser — Free, no API key required
// Parses Google News search RSS feed
// ═══════════════════════════════════════════════════════════════

import Parser from 'rss-parser';
import type { ArticleInput } from './types';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'DistractionIndex/1.0 (civic-intelligence; +https://distractionindex.org)',
  },
});

const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search';

/** Search queries for Google News RSS */
const RSS_QUERIES = [
  'trump executive order site:reuters.com OR site:apnews.com',
  'DOJ lawsuit federal government',
  'trump administration policy action',
];

/**
 * Fetch articles from Google News RSS for a search query.
 */
export async function searchGoogleNews(query: string): Promise<ArticleInput[]> {
  const url = new URL(GOOGLE_NEWS_RSS);
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'en-US');
  url.searchParams.set('gl', 'US');
  url.searchParams.set('ceid', 'US:en');

  try {
    const feed = await parser.parseURL(url.toString());

    return (feed.items || []).map((item): ArticleInput => {
      // Google News RSS wraps the real source in the title as "Headline - Publisher"
      const titleParts = (item.title || '').split(' - ');
      const publisher = titleParts.length > 1 ? titleParts.pop()!.trim() : 'unknown';
      const headline = titleParts.join(' - ').trim();

      return {
        url: item.link || '',
        headline,
        summary: item.contentSnippet || undefined,
        publisher,
        published_at: item.isoDate || item.pubDate || new Date().toISOString(),
        source: 'google_news',
      };
    });
  } catch (err) {
    console.error(`Google News RSS failed for "${query}":`, err);
    return [];
  }
}

/**
 * Fetch recent articles across multiple queries.
 */
export async function fetchGoogleNewsRecent(): Promise<ArticleInput[]> {
  const results: ArticleInput[] = [];

  for (const query of RSS_QUERIES) {
    const articles = await searchGoogleNews(query);
    results.push(...articles);
    // Be respectful with rate
    await new Promise((r) => setTimeout(r, 1000));
  }

  return results;
}
