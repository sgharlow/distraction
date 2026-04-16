import { describe, it, expect } from 'vitest';
import robots from '@/app/robots';

describe('robots.ts', () => {
  it('returns a rules array', () => {
    const result = robots();
    expect(result.rules).toBeDefined();
    expect(Array.isArray(result.rules)).toBe(true);
  });

  it('has a wildcard user agent rule', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const wildcardRule = rules.find((r) => r.userAgent === '*');
    expect(wildcardRule).toBeDefined();
  });

  it('allows root path', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const wildcardRule = rules.find((r) => r.userAgent === '*');
    expect(wildcardRule?.allow).toBe('/');
  });

  it('disallows /admin path', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const wildcardRule = rules.find((r) => r.userAgent === '*');
    const disallowed = Array.isArray(wildcardRule?.disallow) ? wildcardRule.disallow : [wildcardRule?.disallow];
    expect(disallowed).toContain('/admin');
  });

  it('disallows /api/ path', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const wildcardRule = rules.find((r) => r.userAgent === '*');
    const disallowed = Array.isArray(wildcardRule?.disallow) ? wildcardRule.disallow : [wildcardRule?.disallow];
    expect(disallowed).toContain('/api/');
  });

  it('includes sitemap URLs', () => {
    const result = robots();
    expect(result.sitemap).toBeDefined();
    const sitemaps = Array.isArray(result.sitemap) ? result.sitemap : [result.sitemap];
    expect(sitemaps.length).toBeGreaterThanOrEqual(1);
  });

  it('sitemap points to distractionindex.org', () => {
    const result = robots();
    const sitemaps = Array.isArray(result.sitemap) ? result.sitemap : [result.sitemap];
    for (const s of sitemaps) {
      expect(s).toContain('distractionindex.org');
    }
  });

  it('includes both main sitemap and news sitemap', () => {
    const result = robots();
    const sitemaps = Array.isArray(result.sitemap) ? result.sitemap : [result.sitemap];
    const hasMain = sitemaps.some((s) => s?.includes('sitemap.xml'));
    const hasNews = sitemaps.some((s) => s?.includes('news-sitemap.xml'));
    expect(hasMain).toBe(true);
    expect(hasNews).toBe(true);
  });
});
