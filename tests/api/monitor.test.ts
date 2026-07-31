import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FreshnessStatus } from '@/lib/monitor/freshness';
import type { StuckWeekStatus } from '@/lib/monitor/stuck-week';
import type { MissingBlogStatus } from '@/lib/monitor/missing-blog';

// ── Mock the freshness check, stuck-week check, missing-blog check, and alert sender ──
const mockCheck = vi.fn();
const mockStuck = vi.fn();
const mockBlogs = vi.fn();
const mockSend = vi.fn();

vi.mock('@/lib/monitor/freshness', () => ({
  checkPipelineFreshness: (...args: unknown[]) => mockCheck(...args),
}));
vi.mock('@/lib/monitor/stuck-week', () => ({
  checkStuckWeeks: (...args: unknown[]) => mockStuck(...args),
}));
vi.mock('@/lib/monitor/missing-blog', () => ({
  checkMissingBlogs: (...args: unknown[]) => mockBlogs(...args),
}));
vi.mock('@/lib/monitor/alert', () => ({
  sendHealthAlert: (...args: unknown[]) => mockSend(...args),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
  NextRequest: class {},
}));

function createRequest(secret?: string) {
  const headers = new Map<string, string>();
  if (secret) headers.set('authorization', `Bearer ${secret}`);
  return { headers: { get: (k: string) => headers.get(k) ?? null } };
}

const FRESH: FreshnessStatus = {
  healthy: true, state: 'fresh', lastSuccessfulIngestAt: '2026-07-30T09:00:00Z',
  ageHours: 3, thresholdHours: 10, articlesLastRun: 40, detail: 'ok',
};
const STALE: FreshnessStatus = {
  healthy: false, state: 'stale', lastSuccessfulIngestAt: '2026-07-09T00:00:00Z',
  ageHours: 500, thresholdHours: 10, articlesLastRun: 0, detail: 'dead',
};
const STUCK_OK: StuckWeekStatus = {
  healthy: true, state: 'ok', stuckWeeks: [], detail: 'no stuck weeks',
};
const STUCK_BAD: StuckWeekStatus = {
  healthy: false, state: 'stuck', stuckWeeks: ['2026-07-05'], detail: 'freeze missed',
};
const BLOGS_OK: MissingBlogStatus = {
  healthy: true, state: 'ok', missingWeeks: [], detail: 'no missing blogs',
};
const BLOGS_BAD: MissingBlogStatus = {
  healthy: false, state: 'missing', missingWeeks: ['2026-07-12'], detail: 'blog never wrote',
};

describe('GET /api/monitor', () => {
  let handler: (req: unknown) => Promise<{ status: number; json: () => Promise<unknown> }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
    // Default all checks healthy; individual tests override.
    mockStuck.mockResolvedValue(STUCK_OK);
    mockBlogs.mockResolvedValue(BLOGS_OK);
    const mod = await import('@/app/api/monitor/route');
    handler = mod.GET;
  });

  it('returns 401 without auth', async () => {
    const res = await handler(createRequest());
    expect(res.status).toBe(401);
    expect(mockCheck).not.toHaveBeenCalled();
  });

  it('does not send an alert when all checks are healthy', async () => {
    mockCheck.mockResolvedValue(FRESH);
    mockStuck.mockResolvedValue(STUCK_OK);
    mockBlogs.mockResolvedValue(BLOGS_OK);
    const res = await handler(createRequest('test-cron-secret'));
    const body = await res.json() as { ok: boolean; freshness: FreshnessStatus; stuck: StuckWeekStatus; blogs: MissingBlogStatus; alert: { sent: boolean } };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.freshness.state).toBe('fresh');
    expect(body.stuck.state).toBe('ok');
    expect(body.blogs.state).toBe('ok');
    expect(mockSend).not.toHaveBeenCalled();
    expect(body.alert.sent).toBe(false);
  });

  it('sends an alert when ingest is stale', async () => {
    mockCheck.mockResolvedValue(STALE);
    mockStuck.mockResolvedValue(STUCK_OK);
    mockSend.mockResolvedValue({ sent: true });
    const res = await handler(createRequest('test-cron-secret'));
    const body = await res.json() as { alert: { sent: boolean } };
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith({ freshness: STALE, stuck: STUCK_OK, blogs: BLOGS_OK });
    expect(body.alert.sent).toBe(true);
  });

  it('sends an alert when a week freeze is stuck even though ingest is fresh', async () => {
    mockCheck.mockResolvedValue(FRESH);
    mockStuck.mockResolvedValue(STUCK_BAD);
    mockSend.mockResolvedValue({ sent: true });
    const res = await handler(createRequest('test-cron-secret'));
    const body = await res.json() as { alert: { sent: boolean } };
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith({ freshness: FRESH, stuck: STUCK_BAD, blogs: BLOGS_OK });
    expect(body.alert.sent).toBe(true);
  });

  it('sends an alert when a blog is missing even though ingest and freeze are fine', async () => {
    // The weeks 67-83 signature: everything else looks healthy, no blog wrote.
    mockCheck.mockResolvedValue(FRESH);
    mockStuck.mockResolvedValue(STUCK_OK);
    mockBlogs.mockResolvedValue(BLOGS_BAD);
    mockSend.mockResolvedValue({ sent: true });
    const res = await handler(createRequest('test-cron-secret'));
    const body = await res.json() as { blogs: MissingBlogStatus; alert: { sent: boolean } };
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith({ freshness: FRESH, stuck: STUCK_OK, blogs: BLOGS_BAD });
    expect(body.blogs.missingWeeks).toEqual(['2026-07-12']);
    expect(body.alert.sent).toBe(true);
  });

  it('still returns 200 when the alert send fails (cron itself succeeded)', async () => {
    mockCheck.mockResolvedValue(STALE);
    mockStuck.mockResolvedValue(STUCK_OK);
    mockSend.mockResolvedValue({ sent: false, error: 'Resend 500' });
    const res = await handler(createRequest('test-cron-secret'));
    const body = await res.json() as { ok: boolean; alert: { sent: boolean; error?: string } };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.alert.sent).toBe(false);
    expect(body.alert.error).toContain('Resend 500');
  });
});

describe('GET /api/health', () => {
  let handler: () => Promise<{ status: number; json: () => Promise<unknown> }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStuck.mockResolvedValue(STUCK_OK);
    mockBlogs.mockResolvedValue(BLOGS_OK);
    const mod = await import('@/app/api/health/route');
    handler = mod.GET;
  });

  it('returns 200 when ingest is fresh', async () => {
    mockCheck.mockResolvedValue(FRESH);
    mockStuck.mockResolvedValue(STUCK_OK);
    const res = await handler();
    expect(res.status).toBe(200);
    const body = await res.json() as FreshnessStatus & { stuck: StuckWeekStatus; blogs: MissingBlogStatus };
    expect(body.healthy).toBe(true);
    expect(body.stuck.state).toBe('ok');
    expect(body.blogs.state).toBe('ok');
  });

  it('returns 503 when ingest is stale (fail-closed for uptime monitors)', async () => {
    mockCheck.mockResolvedValue(STALE);
    mockStuck.mockResolvedValue(STUCK_OK);
    const res = await handler();
    expect(res.status).toBe(503);
    const body = await res.json() as FreshnessStatus;
    expect(body.healthy).toBe(false);
  });

  it('stays 200 when ingest is fresh but a week freeze is stuck (site is up; monitor owns that alert)', async () => {
    mockCheck.mockResolvedValue(FRESH);
    mockStuck.mockResolvedValue(STUCK_BAD);
    const res = await handler();
    expect(res.status).toBe(200);
    const body = await res.json() as FreshnessStatus & { stuck: StuckWeekStatus };
    expect(body.healthy).toBe(true);
    expect(body.stuck.state).toBe('stuck');
  });

  it('stays 200 when a blog is missing (content gap, not an outage — monitor owns that alert)', async () => {
    mockCheck.mockResolvedValue(FRESH);
    mockStuck.mockResolvedValue(STUCK_OK);
    mockBlogs.mockResolvedValue(BLOGS_BAD);
    const res = await handler();
    expect(res.status).toBe(200);
    const body = await res.json() as FreshnessStatus & { blogs: MissingBlogStatus };
    expect(body.healthy).toBe(true);
    expect(body.blogs.state).toBe('missing');
    expect(body.blogs.missingWeeks).toEqual(['2026-07-12']);
  });
});
