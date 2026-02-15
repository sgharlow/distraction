// ═══════════════════════════════════════════════════════════════
// Article Deduplication
// URL exact match + headline similarity check
// ═══════════════════════════════════════════════════════════════

import type { ArticleInput } from './types';
import { tokenSimilarity } from './similarity';

/**
 * Normalize a URL for dedup: strip protocol, www, trailing slashes, query params.
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, '') + u.pathname).replace(/\/$/, '').toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

/**
 * Deduplicate articles against each other and against existing URLs.
 *
 * @param articles - New articles from ingestion
 * @param existingUrls - Set of URLs already in the database
 * @param headlineSimilarityThreshold - Threshold for headline similarity (default 0.85)
 * @returns Deduplicated articles
 */
export function deduplicateArticles(
  articles: ArticleInput[],
  existingUrls: Set<string>,
  headlineSimilarityThreshold = 0.7,
): ArticleInput[] {
  const normalizedExisting = new Set(
    Array.from(existingUrls).map(normalizeUrl),
  );

  const seen = new Set<string>();
  const seenHeadlines: string[] = [];
  const result: ArticleInput[] = [];

  for (const article of articles) {
    // Skip if URL already exists in DB
    const normUrl = normalizeUrl(article.url);
    if (normalizedExisting.has(normUrl)) continue;

    // Skip if we've already seen this URL in this batch
    if (seen.has(normUrl)) continue;

    // Skip if headline is too similar to one we've already included
    const isDupeHeadline = seenHeadlines.some(
      (h) => tokenSimilarity(h, article.headline) >= headlineSimilarityThreshold,
    );
    if (isDupeHeadline) continue;

    // Skip articles with empty/missing headlines
    if (!article.headline || article.headline.trim().length < 10) continue;

    seen.add(normUrl);
    seenHeadlines.push(article.headline);
    result.push(article);
  }

  return result;
}
