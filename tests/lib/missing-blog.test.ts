import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Supabase admin client ──
// checkMissingBlogs queries three tables:
//   weekly_snapshots .select().eq('status','frozen')
//   blog_posts       .select()
//   events           .select().eq('week_id',wk).not('primary_list','is',null)
// Each chain is awaited and resolves to { data, error }, so the builder is a
// thenable that dispatches on table name (and, for events, on the week_id it
// was filtered by).
let frozenResult: { data: unknown; error: unknown };
let blogsResult: { data: unknown; error: unknown };
let eventsByWeek: Record<string, { data: unknown; error: unknown }>;
let throwOnBuild = false;

function makeBuilder(table: string) {
  const builder: Record<string, unknown> = {};
  let weekId = '';
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.not = vi.fn(chain);
  builder.eq = vi.fn((col: string, val: string) => {
    if (col === 'week_id') weekId = val;
    return builder;
  });
  builder.then = (resolve: (v: unknown) => unknown) => {
    let result: { data: unknown; error: unknown };
    if (table === 'weekly_snapshots') result = frozenResult;
    else if (table === 'blog_posts') result = blogsResult;
    else result = eventsByWeek[weekId] ?? { data: [], error: null };
    return Promise.resolve(result).then(resolve);
  };
  return builder;
}

const mockFrom = vi.fn((table: string) => {
  if (throwOnBuild) throw new Error('connect ECONNREFUSED (supabase paused)');
  return makeBuilder(table);
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import { checkMissingBlogs } from '@/lib/monitor/missing-blog';

// Week 2026-07-12 (Sunday) freezes at 2026-07-19T05:00Z; +6h grace ends 2026-07-19T11:00Z.
// Week 2026-07-19 (Sunday) freezes at 2026-07-26T05:00Z; +6h grace ends 2026-07-26T11:00Z.
const NOW = new Date('2026-07-31T12:00:00Z').getTime();
const frozen = (...weekIds: string[]) => weekIds.map((week_id) => ({ week_id, status: 'frozen' }));
const scored = (n: number) => ({ data: Array.from({ length: n }, (_, i) => ({ id: i + 1 })), error: null });

describe('checkMissingBlogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    throwOnBuild = false;
    frozenResult = { data: [], error: null };
    blogsResult = { data: [], error: null };
    eventsByWeek = {};
  });

  it('reports ok when there are no frozen weeks', async () => {
    const status = await checkMissingBlogs({ now: NOW });
    expect(status.healthy).toBe(true);
    expect(status.state).toBe('ok');
    expect(status.missingWeeks).toEqual([]);
  });

  it('reports ok when every frozen week has a blog', async () => {
    frozenResult = { data: frozen('2026-07-05', '2026-07-12'), error: null };
    blogsResult = { data: [{ week_id: '2026-07-05' }, { week_id: '2026-07-12' }], error: null };
    eventsByWeek = { '2026-07-05': scored(10), '2026-07-12': scored(10) };
    const status = await checkMissingBlogs({ now: NOW });
    expect(status.state).toBe('ok');
    expect(status.missingWeeks).toEqual([]);
  });

  it('flags a frozen week with scored events and no blog (the weeks 67-83 signature)', async () => {
    frozenResult = { data: frozen('2026-07-12'), error: null };
    blogsResult = { data: [], error: null };
    eventsByWeek = { '2026-07-12': scored(217) };
    const status = await checkMissingBlogs({ now: NOW });
    expect(status.healthy).toBe(false);
    expect(status.state).toBe('missing');
    expect(status.missingWeeks).toEqual(['2026-07-12']);
    expect(status.detail).toContain('2026-07-12');
    expect(status.detail).toContain('generate-blog-backlog');
  });

  it('does NOT flag a frozen week that has no scored events (no blog is correct by design)', async () => {
    frozenResult = { data: frozen('2026-07-12'), error: null };
    blogsResult = { data: [], error: null };
    eventsByWeek = { '2026-07-12': scored(0) };
    const status = await checkMissingBlogs({ now: NOW });
    expect(status.state).toBe('ok');
    expect(status.missingWeeks).toEqual([]);
  });

  it('does NOT flag a just-frozen week still inside the blog grace window', async () => {
    // 2026-07-19 grace ends 2026-07-26T11:00Z; probe just before it.
    const withinGrace = new Date('2026-07-26T09:00:00Z').getTime();
    frozenResult = { data: frozen('2026-07-19'), error: null };
    blogsResult = { data: [], error: null };
    eventsByWeek = { '2026-07-19': scored(50) };
    const status = await checkMissingBlogs({ now: withinGrace });
    expect(status.state).toBe('ok');
    expect(status.missingWeeks).toEqual([]);
  });

  it('flags that same week once the grace window has elapsed', async () => {
    const afterGrace = new Date('2026-07-26T12:00:00Z').getTime();
    frozenResult = { data: frozen('2026-07-19'), error: null };
    blogsResult = { data: [], error: null };
    eventsByWeek = { '2026-07-19': scored(50) };
    const status = await checkMissingBlogs({ now: afterGrace });
    expect(status.state).toBe('missing');
    expect(status.missingWeeks).toEqual(['2026-07-19']);
  });

  it('returns multiple missing weeks sorted, ignoring weeks that have blogs', async () => {
    frozenResult = { data: frozen('2026-07-12', '2026-06-28', '2026-07-05'), error: null };
    blogsResult = { data: [{ week_id: '2026-07-05' }], error: null };
    eventsByWeek = { '2026-06-28': scored(53), '2026-07-05': scored(112), '2026-07-12': scored(217) };
    const status = await checkMissingBlogs({ now: NOW });
    expect(status.state).toBe('missing');
    expect(status.missingWeeks).toEqual(['2026-06-28', '2026-07-12']);
  });

  it('respects a custom graceHours', async () => {
    frozenResult = { data: frozen('2026-07-12'), error: null };
    blogsResult = { data: [], error: null };
    eventsByWeek = { '2026-07-12': scored(217) };
    const generous = await checkMissingBlogs({ now: NOW, graceHours: 24 * 365 });
    expect(generous.state).toBe('ok');
  });

  it('FAILS CLOSED when the weekly_snapshots query errors (paused-Supabase signature)', async () => {
    frozenResult = { data: null, error: { message: 'Database is paused' } };
    const status = await checkMissingBlogs({ now: NOW });
    expect(status.healthy).toBe(false);
    expect(status.state).toBe('error');
    expect(status.detail).toContain('Database is paused');
  });

  it('FAILS CLOSED when the blog_posts query errors', async () => {
    frozenResult = { data: frozen('2026-07-12'), error: null };
    blogsResult = { data: null, error: { message: 'blog_posts unreachable' } };
    const status = await checkMissingBlogs({ now: NOW });
    expect(status.healthy).toBe(false);
    expect(status.state).toBe('error');
    expect(status.detail).toContain('blog_posts unreachable');
  });

  it('FAILS CLOSED when the events query errors', async () => {
    frozenResult = { data: frozen('2026-07-12'), error: null };
    blogsResult = { data: [], error: null };
    eventsByWeek = { '2026-07-12': { data: null, error: { message: 'events unreachable' } } };
    const status = await checkMissingBlogs({ now: NOW });
    expect(status.healthy).toBe(false);
    expect(status.state).toBe('error');
    expect(status.detail).toContain('events unreachable');
  });

  it('FAILS CLOSED when the client throws (network/init failure)', async () => {
    throwOnBuild = true;
    const status = await checkMissingBlogs({ now: NOW });
    expect(status.healthy).toBe(false);
    expect(status.state).toBe('error');
    expect(status.detail).toContain('ECONNREFUSED');
  });

  it('ignores an unparseable week_id without crashing the whole check', async () => {
    frozenResult = { data: frozen('not-a-date', '2026-07-12'), error: null };
    blogsResult = { data: [], error: null };
    eventsByWeek = { 'not-a-date': scored(5), '2026-07-12': scored(217) };
    const status = await checkMissingBlogs({ now: NOW });
    expect(status.state).toBe('missing');
    expect(status.missingWeeks).toEqual(['2026-07-12']);
  });
});
