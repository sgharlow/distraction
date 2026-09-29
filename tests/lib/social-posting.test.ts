import { describe, it, expect, vi } from 'vitest';
import {
  checkSocialPosting,
  DEFAULT_SOCIAL_STALENESS_HOURS,
} from '@/lib/monitor/social-posting';

const HANDLE = 'example.bsky.social';
const NOW = Date.parse('2026-09-28T12:00:00Z');

/** One getAuthorFeed item, shaped like the live public API response (probed 2026-09-28). */
function item(indexedAt: string, opts: { handle?: string; repost?: boolean } = {}) {
  return {
    post: {
      author: { handle: opts.handle ?? HANDLE },
      indexedAt,
      record: { createdAt: indexedAt, text: 'post' },
    },
    ...(opts.repost ? { reason: { $type: 'app.bsky.feed.defs#reasonRepost' } } : {}),
  };
}

function feedFetch(feed: unknown[], status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ feed }),
    text: async () => JSON.stringify({ feed }),
  });
}

describe('checkSocialPosting', () => {
  it('is healthy when the account posted inside the threshold', async () => {
    const fetchImpl = feedFetch([item('2026-09-28T01:00:00Z')]);
    const s = await checkSocialPosting({ handle: HANDLE, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(s.healthy).toBe(true);
    expect(s.state).toBe('ok');
    expect(s.lastPostAt).toBe('2026-09-28T01:00:00Z');
    expect(s.ageHours).toBe(11);
  });

  it('is STALE when the newest post is older than the threshold (the 2026-09-05 silent stop)', async () => {
    const fetchImpl = feedFetch([item('2026-09-05T19:30:05Z'), item('2026-09-05T13:30:04Z')]);
    const s = await checkSocialPosting({ handle: HANDLE, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(s.healthy).toBe(false);
    expect(s.state).toBe('stale');
    expect(s.lastPostAt).toBe('2026-09-05T19:30:05Z');
    expect(s.detail).toContain(HANDLE);
    expect(s.detail).toMatch(/\d+h/);
  });

  it('queries the public (unauthenticated) Bluesky author feed for the handle', async () => {
    const fetchImpl = feedFetch([item('2026-09-28T01:00:00Z')]);
    await checkSocialPosting({ handle: HANDLE, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch });
    const url = String(fetchImpl.mock.calls[0][0]);
    expect(url).toMatch(/^https:\/\/public\.api\.bsky\.app\/xrpc\/app\.bsky\.feed\.getAuthorFeed\?/);
    expect(url).toContain(`actor=${HANDLE}`);
  });

  it('ignores reposts — a repost is not the scheduler posting', async () => {
    const fetchImpl = feedFetch([
      item('2026-09-28T10:00:00Z', { repost: true }),
      item('2026-09-20T10:00:00Z'),
    ]);
    const s = await checkSocialPosting({ handle: HANDLE, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(s.state).toBe('stale');
    expect(s.lastPostAt).toBe('2026-09-20T10:00:00Z');
  });

  it('ignores items authored by another account', async () => {
    const fetchImpl = feedFetch([
      item('2026-09-28T10:00:00Z', { handle: 'someone-else.bsky.social' }),
      item('2026-09-20T10:00:00Z'),
    ]);
    const s = await checkSocialPosting({ handle: HANDLE, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(s.lastPostAt).toBe('2026-09-20T10:00:00Z');
  });

  it('fails closed (unhealthy) when the account has no posts at all', async () => {
    const fetchImpl = feedFetch([]);
    const s = await checkSocialPosting({ handle: HANDLE, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(s.healthy).toBe(false);
    expect(s.state).toBe('stale');
    expect(s.lastPostAt).toBeNull();
  });

  it('fails closed with state "error" on a non-OK API response', async () => {
    const fetchImpl = feedFetch([], 502);
    const s = await checkSocialPosting({ handle: HANDLE, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(s.healthy).toBe(false);
    expect(s.state).toBe('error');
    expect(s.detail).toContain('502');
  });

  it('fails closed with state "error" when fetch throws (never throws itself)', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const s = await checkSocialPosting({ handle: HANDLE, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(s.healthy).toBe(false);
    expect(s.state).toBe('error');
    expect(s.detail).toContain('network down');
  });

  it('defaults to a 36h threshold (one fully missed posting day, not one late slot)', () => {
    expect(DEFAULT_SOCIAL_STALENESS_HOURS).toBe(36);
  });

  it('honours an explicit threshold', async () => {
    const fetchImpl = feedFetch([item('2026-09-28T01:00:00Z')]); // 11h old
    const s = await checkSocialPosting({
      handle: HANDLE, now: NOW, thresholdHours: 6, fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(s.state).toBe('stale');
    expect(s.thresholdHours).toBe(6);
  });
});
