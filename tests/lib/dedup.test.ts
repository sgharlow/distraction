import { describe, it, expect } from 'vitest';
import { deduplicateArticles } from '@/lib/ingestion/dedup';
import type { ArticleInput } from '@/lib/ingestion/types';

function makeArticle(overrides: Partial<ArticleInput> = {}): ArticleInput {
  return {
    url: 'https://example.com/article-1',
    headline: 'Trump signs executive order on immigration policy changes for 2025',
    summary: 'The president signed the order today.',
    publisher: 'Test News',
    published_at: '2025-01-15T12:00:00Z',
    source: 'gnews',
    ...overrides,
  };
}

describe('deduplicateArticles', () => {
  it('returns articles that are not in existingUrls', () => {
    const articles = [makeArticle({ url: 'https://example.com/new-article' })];
    const result = deduplicateArticles(articles, new Set());
    expect(result).toHaveLength(1);
  });

  it('removes articles whose URL is in existingUrls', () => {
    const articles = [makeArticle({ url: 'https://example.com/existing' })];
    const existing = new Set(['https://example.com/existing']);
    const result = deduplicateArticles(articles, existing);
    expect(result).toHaveLength(0);
  });

  it('normalizes URLs for comparison (strips www, protocol, trailing slash)', () => {
    const articles = [makeArticle({ url: 'https://www.example.com/article/' })];
    const existing = new Set(['http://example.com/article']);
    const result = deduplicateArticles(articles, existing);
    expect(result).toHaveLength(0);
  });

  it('removes duplicate URLs within the same batch', () => {
    const articles = [
      makeArticle({ url: 'https://example.com/article-1', headline: 'First headline that is long enough to pass' }),
      makeArticle({ url: 'https://example.com/article-1', headline: 'Another headline that is different enough here' }),
    ];
    const result = deduplicateArticles(articles, new Set());
    expect(result).toHaveLength(1);
  });

  it('removes articles with similar headlines', () => {
    const articles = [
      makeArticle({
        url: 'https://example.com/a',
        headline: 'Trump signs executive order on immigration policy',
      }),
      makeArticle({
        url: 'https://example.com/b',
        headline: 'Trump signs executive order on immigration policy today',
      }),
    ];
    const result = deduplicateArticles(articles, new Set());
    // These headlines are very similar — should be deduped
    expect(result).toHaveLength(1);
  });

  it('keeps articles with different headlines', () => {
    const articles = [
      makeArticle({
        url: 'https://example.com/a',
        headline: 'Supreme Court rules on landmark immigration case precedent today',
      }),
      makeArticle({
        url: 'https://example.com/b',
        headline: 'Federal Reserve announces major interest rate changes for banking sector',
      }),
    ];
    const result = deduplicateArticles(articles, new Set());
    expect(result).toHaveLength(2);
  });

  it('filters out articles with empty headlines', () => {
    const articles = [makeArticle({ headline: '' })];
    const result = deduplicateArticles(articles, new Set());
    expect(result).toHaveLength(0);
  });

  it('filters out articles with very short headlines (< 10 chars)', () => {
    const articles = [makeArticle({ headline: 'Short' })];
    const result = deduplicateArticles(articles, new Set());
    expect(result).toHaveLength(0);
  });

  it('keeps articles with sufficiently long headlines', () => {
    const articles = [
      makeArticle({ headline: 'This headline has more than ten characters and is distinct enough' }),
    ];
    const result = deduplicateArticles(articles, new Set());
    expect(result).toHaveLength(1);
  });

  it('handles empty input array', () => {
    expect(deduplicateArticles([], new Set())).toEqual([]);
  });
});
