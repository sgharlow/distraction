import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Why this test exists ──
// Every Vercel env var on distraction-index is Production-scoped, so a preview build has no
// Supabase URL or key. `next build` prerenders /feed.xml (revalidate = 3600), which called
// createAdminClient() unconditionally → "Error: supabaseUrl is required." → every preview
// deployment failed (read on 2026-09-25 from deployment dpl_3km9LcT3hbEkBLkVSUpzSuC7hELx),
// which blocked every Dependabot PR behind a red Vercel check. Without a database the feed
// must be VALID AND EMPTY, never a build failure. With a database it renders the posts.

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
    order: vi.fn(() => chain),
    limit: vi.fn(async () => ({ data: rows })),
  };
  return chain;
}

describe('GET /feed.xml', () => {
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

  it('without Supabase env (a preview build) it returns a valid, empty Atom feed and never touches the database', async () => {
    for (const k of ENV_KEYS) delete process.env[k];
    const { GET } = await import('@/app/feed.xml/route');
    const res = await GET();
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/atom+xml');
    expect(body).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(body).not.toContain('<entry>');
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('with Supabase env it renders the posts', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
    mockFrom.mockReturnValue(
      queryChain([
        { slug: 'week-1', title: 'Week 1 & more', meta_description: 'd', published_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-02T00:00:00Z', week_id: 'w1' },
      ]),
    );
    const { GET } = await import('@/app/feed.xml/route');
    const res = await GET();
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(mockCreateAdminClient).toHaveBeenCalledTimes(1);
    expect(body).toContain('<entry>');
    expect(body).toContain('Week 1 &amp; more');
    expect(body).toContain('/blog/week-1');
  });
});
