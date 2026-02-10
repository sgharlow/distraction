// ═══════════════════════════════════════════════════════════════
// Article Deduplication
// URL exact match + headline similarity check
// ═══════════════════════════════════════════════════════════════

import type { ArticleInput } from './types';

/**
 * Simple Levenshtein distance between two strings (normalized to 0-1 similarity).
 */
function similarity(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  if (la.length === 0 || lb.length === 0) return 0;

  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 1;

  // Use token overlap for speed (faster than Levenshtein for headlines)
  const tokensA = new Set(la.split(/\s+/).filter((t) => t.length > 2));
  const tokensB = new Set(lb.split(/\s+/).filter((t) => t.length > 2));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }

  return overlap / Math.max(tokensA.size, tokensB.size);
}

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
  headlineSimilarityThreshold = 0.8,
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
      (h) => similarity(h, article.headline) >= headlineSimilarityThreshold,
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
