import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Supabase admin client ──
// The stuck-week query is from().select().eq() and is awaited, resolving to
// { data, error }. A thenable builder makes the whole chain awaitable.
let queryResult: { data: unknown; error: unknown };
let throwOnBuild = false;

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(queryResult).then(resolve);
  return builder;
}

const mockFrom = vi.fn(() => {
  if (throwOnBuild) throw new Error('connect ECONNREFUSED (supabase paused)');
  return makeBuilder();
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import { checkStuckWeeks } from '@/lib/monitor/stuck-week';

// Week 2026-07-05 (Sunday) freezes at 2026-07-12T05:00Z; +24h grace ends 2026-07-13T05:00Z.
// Week 2026-07-19 (Sunday) freezes at 2026-07-26T05:00Z; +24h grace ends 2026-07-27T05:00Z.
const NOW = new Date('2026-07-30T12:00:00Z').getTime();
const live = (...weekIds: string[]) => weekIds.map((week_id) => ({ week_id, status: 'live' }));

describe('checkStuckWeeks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    throwOnBuild = false;
    queryResult = { data: [], error: null };
  });

  it('reports ok when there are no live weeks', async () => {
    queryResult = { data: [], error: null };
    const status = await checkStuckWeeks({ now: NOW });
    expect(status.healthy).toBe(true);
    expect(status.state).toBe('ok');
    expect(status.stuckWeeks).toEqual([]);
  });

  it('flags a week left live long past its freeze window', async () => {
    queryResult = { data: live('2026-07-05'), error: null };
    const status = await checkStuckWeeks({ now: NOW });
    expect(status.healthy).toBe(false);
    expect(status.state).toBe('stuck');
    expect(status.stuckWeeks).toEqual(['2026-07-05']);
    expect(status.detail).toContain('2026-07-05');
  });

  it('does NOT flag the current week (freeze time still in the future)', async () => {
    // Week starting 2026-08-02 freezes 2026-08-09T05:00Z — well after NOW (07-30).
    queryResult = { data: live('2026-08-02'), error: null };
    const status = await checkStuckWeeks({ now: NOW });
    expect(status.state).toBe('ok');
    expect(status.stuckWeeks).toEqual([]);
  });

  it('does NOT flag a just-ended week still inside its freeze grace window', async () => {
    // Week 2026-07-19 grace ends 2026-07-27T05:00Z; probe just before it.
    const withinGrace = new Date('2026-07-27T00:00:00Z').getTime();
    queryResult = { data: live('2026-07-19'), error: null };
    const status = await checkStuckWeeks({ now: withinGrace });
    expect(status.state).toBe('ok');
    expect(status.stuckWeeks).toEqual([]);
  });

  it('flags that same week once the grace window has elapsed', async () => {
    const afterGrace = new Date('2026-07-27T06:00:00Z').getTime();
    queryResult = { data: live('2026-07-19'), error: null };
    const status = await checkStuckWeeks({ now: afterGrace });
    expect(status.state).toBe('stuck');
    expect(status.stuckWeeks).toEqual(['2026-07-19']);
  });

  it('returns multiple stuck weeks sorted, ignoring non-stuck live weeks', async () => {
    // 07-05 and 07-19 are stuck at NOW; 08-02 (current) is not.
    queryResult = { data: live('2026-07-19', '2026-08-02', '2026-07-05'), error: null };
    const status = await checkStuckWeeks({ now: NOW });
    expect(status.state).toBe('stuck');
    expect(status.stuckWeeks).toEqual(['2026-07-05', '2026-07-19']);
  });

  it('respects a custom graceHours', async () => {
    // 07-05 freeze due 2026-07-12T05:00Z. With a huge grace it is not yet stuck at NOW.
    queryResult = { data: live('2026-07-05'), error: null };
    const generous = await checkStuckWeeks({ now: NOW, graceHours: 24 * 365 });
    expect(generous.state).toBe('ok');
  });

  it('FAILS CLOSED when the DB query returns an error (paused-Supabase signature)', async () => {
    queryResult = { data: null, error: { message: 'Database is paused' } };
    const status = await checkStuckWeeks({ now: NOW });
    expect(status.healthy).toBe(false);
    expect(status.state).toBe('error');
    expect(status.detail).toContain('Database is paused');
  });

  it('FAILS CLOSED when the client throws (network/init failure)', async () => {
    throwOnBuild = true;
    const status = await checkStuckWeeks({ now: NOW });
    expect(status.healthy).toBe(false);
    expect(status.state).toBe('error');
    expect(status.detail).toContain('ECONNREFUSED');
  });

  it('ignores an unparseable week_id without crashing the whole check', async () => {
    queryResult = { data: live('not-a-date', '2026-07-05'), error: null };
    const status = await checkStuckWeeks({ now: NOW });
    expect(status.state).toBe('stuck');
    expect(status.stuckWeeks).toEqual(['2026-07-05']);
  });
});
