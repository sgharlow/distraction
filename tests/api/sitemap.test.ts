import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Same defect class as feed.xml (see tests/api/feed.test.ts): sitemap.ts runs at build and
// constructed the admin client unconditionally. Without a database the sitemap is the static
// pages only — valid, never a build failure. With a database it lists weeks and blog posts.

const tables: Record<string, unknown[]> = {};
const mockFrom = vi.fn((table: string) => {
  const chain = {
    select: vi.fn(() => chain),
    order: vi.fn(async () => ({ data: tables[table] ?? [] })),
  };
  return chain;
});
const mockCreateAdminClient = vi.fn(() => ({ from: mockFrom }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

const ENV_KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
const saved: Record<string, string | undefined> = {};

describe('sitemap()', () => {
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

  it('without Supabase env it returns the static pages only and never touches the database', async () => {
    for (const k of ENV_KEYS) delete process.env[k];
    const { default: sitemap } = await import('@/app/sitemap');
    const entries = await sitemap();

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => !/\/week\/20|\/blog\//.test(e.url))).toBe(true);
    expect(entries.some((e) => e.url.endsWith('/week/current'))).toBe(true);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('with Supabase env it lists weeks and blog posts', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
    tables.weekly_snapshots = [{ week_id: '2026-W38', status: 'frozen', frozen_at: '2026-09-21T00:00:00Z', created_at: '2026-09-14T00:00:00Z' }];
    tables.blog_posts = [{ slug: 'hello', published_at: '2026-09-01T00:00:00Z', updated_at: null }];
    const { default: sitemap } = await import('@/app/sitemap');
    const entries = await sitemap();

    expect(mockCreateAdminClient).toHaveBeenCalledTimes(1);
    expect(entries.some((e) => e.url.endsWith('/week/2026-W38'))).toBe(true);
    expect(entries.some((e) => e.url.endsWith('/blog/hello'))).toBe(true);
  });
});
