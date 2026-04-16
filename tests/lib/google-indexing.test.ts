import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isGoogleIndexingConfigured } from '@/lib/google-indexing';

describe('isGoogleIndexingConfigured', () => {
  const originalEnv = process.env.GOOGLE_INDEXING_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.GOOGLE_INDEXING_KEY = originalEnv;
    } else {
      delete process.env.GOOGLE_INDEXING_KEY;
    }
  });

  it('returns false when GOOGLE_INDEXING_KEY is not set', () => {
    delete process.env.GOOGLE_INDEXING_KEY;
    expect(isGoogleIndexingConfigured()).toBe(false);
  });

  it('returns false when GOOGLE_INDEXING_KEY is empty string', () => {
    process.env.GOOGLE_INDEXING_KEY = '';
    expect(isGoogleIndexingConfigured()).toBe(false);
  });

  it('returns true when GOOGLE_INDEXING_KEY is set', () => {
    process.env.GOOGLE_INDEXING_KEY = 'some-base64-key';
    expect(isGoogleIndexingConfigured()).toBe(true);
  });
});

describe('notifyGoogleIndexing (no key configured)', () => {
  let notifyGoogleIndexing: (url: string, action?: 'URL_UPDATED' | 'URL_DELETED') => Promise<{ url: string; success: boolean; error?: string }>;

  beforeEach(async () => {
    vi.resetModules();
    delete process.env.GOOGLE_INDEXING_KEY;
    const mod = await import('@/lib/google-indexing');
    notifyGoogleIndexing = mod.notifyGoogleIndexing;
  });

  it('returns error result when GOOGLE_INDEXING_KEY is not configured', async () => {
    const result = await notifyGoogleIndexing('https://distractionindex.org/week/current');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
    expect(result.url).toBe('https://distractionindex.org/week/current');
  });
});

describe('notifyGoogleIndexingBatch (no key configured)', () => {
  let notifyGoogleIndexingBatch: (urls: string[], action?: 'URL_UPDATED' | 'URL_DELETED') => Promise<Array<{ url: string; success: boolean; error?: string }>>;

  beforeEach(async () => {
    vi.resetModules();
    delete process.env.GOOGLE_INDEXING_KEY;
    const mod = await import('@/lib/google-indexing');
    notifyGoogleIndexingBatch = mod.notifyGoogleIndexingBatch;
  });

  it('returns error results for all URLs when not configured', async () => {
    const urls = [
      'https://distractionindex.org/week/2026-01-05',
      'https://distractionindex.org/week/2026-01-12',
    ];
    const results = await notifyGoogleIndexingBatch(urls);
    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    }
  });

  it('returns empty array for empty input', async () => {
    const results = await notifyGoogleIndexingBatch([]);
    expect(results).toEqual([]);
  });
});
