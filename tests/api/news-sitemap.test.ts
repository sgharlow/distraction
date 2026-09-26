import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Same defect class as feed.xml (see tests/api/feed.test.ts): this route is prerendered at build
// and constructed the admin client unconditionally, so a preview build with no Supabase env died
// here the moment feed.xml stopped dying ("Export encountered an error on /news-sitemap.xml/route",
// deployment dpl_G5YnxxXktLnLMr8FF5E1CgaoZBkk, 2026-09-25). Without a database: valid and empty.

const mockFrom = vi.fn();
const mockCreateAdminClient = vi.fn(() => ({ from: mockFrom }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

const ENV_KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
const saved: Record<string, string | undefined> = {};

function queryChain(rows: unknown[]) {
  const chain = {
    select: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(async () => ({ data: rows })),
  };
  return chain;
}

describe('GET /news-sitemap.xml', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of ENV_KEYS) saved[k] = process.env[k];
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('without Supabase env it returns a valid, empty news sitemap and never touches the database', async () => {
    for (const k of ENV_KEYS) delete process.env[k];
    const { GET } = await import('@/app/news-sitemap.xml/route');
    const res = await GET();
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain('<urlset');
    expect(body).not.toContain('<url>');
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('with Supabase env it renders the recent events', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
    mockFrom.mockReturnValue(
      queryChain([{ id: 'ev-1', title: 'Title <one>', event_date: null, created_at: '2026-09-25T00:00:00Z', topic_tags: ['a', 'b'] }]),
    );
    const { GET } = await import('@/app/news-sitemap.xml/route');
    const body = await (await GET()).text();

    expect(mockCreateAdminClient).toHaveBeenCalledTimes(1);
    expect(body).toContain('/event/ev-1');
    expect(body).toContain('Title &lt;one&gt;');
    expect(body).toContain('<news:keywords>a, b</news:keywords>');
  });
});
