import { describe, it, expect, vi, afterEach } from 'vitest';

// content-variants builds a Supabase client on import; postToTwitter never needs it.
vi.mock('../../scripts/outreach/content-variants', () => ({ generatePost: vi.fn() }));

import { postToTwitter } from '../../scripts/outreach/twitter-post';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('postToTwitter while X is disabled (Steve, 2026-10-20)', () => {
  it('makes no network call even with credentials configured, and returns the disabled result', async () => {
    vi.stubEnv('TWITTER_API_KEY', 'k');
    vi.stubEnv('TWITTER_API_SECRET', 's');
    vi.stubEnv('TWITTER_ACCESS_TOKEN', 't');
    vi.stubEnv('TWITTER_ACCESS_TOKEN_SECRET', 'ts');
    const fetchSpy = vi.fn(async () => new Response('{"detail":"credits depleted"}', { status: 402 }));
    vi.stubGlobal('fetch', fetchSpy);

    const short = await postToTwitter('short post');
    const thread = await postToTwitter('x'.repeat(600));

    expect(fetchSpy).not.toHaveBeenCalled();
    for (const r of [short, thread]) {
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/^X posting disabled/);
    }
  });
});
