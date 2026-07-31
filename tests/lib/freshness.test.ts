import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Supabase admin client with a chainable query builder ──
// The freshness query is: from().select().eq().eq().gt().order().limit()
// and is awaited, resolving to { data, error }.
let queryResult: { data: unknown; error: unknown };
let throwOnBuild = false;

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.gt = vi.fn(chain);
  builder.order = vi.fn(chain);
  // limit() is the awaited terminal — return a thenable resolving to queryResult
  builder.limit = vi.fn(() => Promise.resolve(queryResult));
  return builder;
}

const mockFrom = vi.fn(() => {
  if (throwOnBuild) throw new Error('connect ECONNREFUSED (supabase paused)');
  return makeBuilder();
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import { checkPipelineFreshness } from '@/lib/monitor/freshness';

const NOW = new Date('2026-07-30T12:00:00Z').getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

describe('checkPipelineFreshness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    throwOnBuild = false;
    queryResult = { data: [], error: null };
  });

  it('reports fresh when a recent article-bearing ingest exists', async () => {
    queryResult = { data: [{ completed_at: hoursAgo(3), started_at: hoursAgo(3), articles_fetched: 42 }], error: null };
    const status = await checkPipelineFreshness({ now: NOW });
    expect(status.healthy).toBe(true);
    expect(status.state).toBe('fresh');
    expect(status.ageHours).toBe(3);
    expect(status.articlesLastRun).toBe(42);
  });

  it('reports stale when the last ingest is older than the threshold', async () => {
    queryResult = { data: [{ completed_at: hoursAgo(30), started_at: hoursAgo(30), articles_fetched: 10 }], error: null };
    const status = await checkPipelineFreshness({ now: NOW, thresholdHours: 10 });
    expect(status.healthy).toBe(false);
    expect(status.state).toBe('stale');
    expect(status.ageHours).toBe(30);
  });

  it('respects a custom threshold (boundary: exactly at threshold is fresh)', async () => {
    queryResult = { data: [{ completed_at: hoursAgo(10), started_at: hoursAgo(10), articles_fetched: 5 }], error: null };
    const status = await checkPipelineFreshness({ now: NOW, thresholdHours: 10 });
    expect(status.state).toBe('fresh'); // ageHours > threshold is stale; == is not
  });

  it('FAILS CLOSED when the DB query returns an error (paused-Supabase signature)', async () => {
    queryResult = { data: null, error: { message: 'Database is paused' } };
    const status = await checkPipelineFreshness({ now: NOW });
    expect(status.healthy).toBe(false);
    expect(status.state).toBe('error');
    expect(status.detail).toContain('Database is paused');
  });

  it('FAILS CLOSED when the client throws (network/init failure)', async () => {
    throwOnBuild = true;
    const status = await checkPipelineFreshness({ now: NOW });
    expect(status.healthy).toBe(false);
    expect(status.state).toBe('error');
    expect(status.detail).toContain('ECONNREFUSED');
  });

  it('reports stale (not error) when no successful ingest row exists at all', async () => {
    queryResult = { data: [], error: null };
    const status = await checkPipelineFreshness({ now: NOW });
    expect(status.healthy).toBe(false);
    expect(status.state).toBe('stale');
    expect(status.lastSuccessfulIngestAt).toBeNull();
  });

  it('FAILS CLOSED on an unparseable timestamp', async () => {
    queryResult = { data: [{ completed_at: 'not-a-date', started_at: null, articles_fetched: 3 }], error: null };
    const status = await checkPipelineFreshness({ now: NOW });
    expect(status.healthy).toBe(false);
    expect(status.state).toBe('error');
  });
});
