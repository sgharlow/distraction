import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendHealthAlert, type HealthReport } from '@/lib/monitor/alert';
import type { FreshnessStatus } from '@/lib/monitor/freshness';
import type { StuckWeekStatus } from '@/lib/monitor/stuck-week';
import type { MissingBlogStatus } from '@/lib/monitor/missing-blog';

const STALE: FreshnessStatus = {
  healthy: false, state: 'stale', lastSuccessfulIngestAt: '2026-07-09T00:00:00Z',
  ageHours: 500, thresholdHours: 10, articlesLastRun: 0,
  detail: 'Last article-bearing ingest was 500h ago',
};

const FRESH: FreshnessStatus = {
  healthy: true, state: 'fresh', lastSuccessfulIngestAt: '2026-07-30T00:00:00Z',
  ageHours: 1, thresholdHours: 10, articlesLastRun: 510,
  detail: 'Last article-bearing ingest was 1h ago',
};

const STUCK_OK: StuckWeekStatus = {
  healthy: true, state: 'ok', stuckWeeks: [],
  detail: 'No stuck-live weeks.',
};

const STUCK_BAD: StuckWeekStatus = {
  healthy: false, state: 'stuck', stuckWeeks: ['2026-07-05'],
  detail: "1 week(s) still 'live' past their freeze window (+24h grace): 2026-07-05. A freeze cron was missed.",
};

const BLOGS_OK: MissingBlogStatus = {
  healthy: true, state: 'ok', missingWeeks: [],
  detail: 'No missing blog posts.',
};

const BLOGS_BAD: MissingBlogStatus = {
  healthy: false, state: 'missing', missingWeeks: ['2026-07-12'],
  detail: '1 frozen week(s) with scored events have NO blog post: 2026-07-12.',
};

const staleReport: HealthReport = { freshness: STALE, stuck: STUCK_OK };
const stuckReport: HealthReport = { freshness: FRESH, stuck: STUCK_BAD };
const blogReport: HealthReport = { freshness: FRESH, stuck: STUCK_OK, blogs: BLOGS_BAD };

const ORIGINAL = { key: process.env.RESEND_API_KEY, to: process.env.ALERT_EMAIL };

describe('sendHealthAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-key';
    process.env.ALERT_EMAIL = 'ops@example.com';
  });
  afterEach(() => {
    process.env.RESEND_API_KEY = ORIGINAL.key;
    process.env.ALERT_EMAIL = ORIGINAL.to;
  });

  it('skips (does not throw) when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    const fetchImpl = vi.fn();
    const res = await sendHealthAlert(staleReport, fetchImpl as unknown as typeof fetch);
    expect(res.sent).toBe(false);
    expect(res.skippedReason).toContain('RESEND_API_KEY');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('skips when ALERT_EMAIL is missing', async () => {
    delete process.env.ALERT_EMAIL;
    const fetchImpl = vi.fn();
    const res = await sendHealthAlert(staleReport, fetchImpl as unknown as typeof fetch);
    expect(res.sent).toBe(false);
    expect(res.skippedReason).toContain('ALERT_EMAIL');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('POSTs to Resend with the recipient and a critical (ingest) subject when stale', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const res = await sendHealthAlert(staleReport, fetchImpl as unknown as typeof fetch);
    expect(res.sent).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    const payload = JSON.parse((init as { body: string }).body);
    expect(payload.to).toBe('ops@example.com');
    expect(payload.subject).toContain('STALE');
    expect(payload.text).toContain('dead-man');
    expect(payload.text).toContain('Ingest freshness');
  });

  it('sends a freeze-missed subject and names the stuck week when only the freeze is stuck', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const res = await sendHealthAlert(stuckReport, fetchImpl as unknown as typeof fetch);
    expect(res.sent).toBe(true);
    const payload = JSON.parse((fetchImpl.mock.calls[0][1] as { body: string }).body);
    expect(payload.subject).toContain('freeze missed');
    expect(payload.subject).toContain('2026-07-05');
    expect(payload.text).toContain('Week freeze');
    expect(payload.text).toContain('2026-07-05');
  });

  it('sends a blog-missing subject and names the week when only the blog is missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const res = await sendHealthAlert(blogReport, fetchImpl as unknown as typeof fetch);
    expect(res.sent).toBe(true);
    const payload = JSON.parse((fetchImpl.mock.calls[0][1] as { body: string }).body);
    expect(payload.subject).toContain('blog post missing');
    expect(payload.subject).toContain('2026-07-12');
    expect(payload.text).toContain('Blog posts');
    expect(payload.text).toContain('2026-07-12');
  });

  it('omits the blog section entirely when blogs are healthy', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await sendHealthAlert({ freshness: STALE, stuck: STUCK_OK, blogs: BLOGS_OK }, fetchImpl as unknown as typeof fetch);
    const payload = JSON.parse((fetchImpl.mock.calls[0][1] as { body: string }).body);
    expect(payload.text).not.toContain('Blog posts');
    // ...and the ingest problem still owns the subject.
    expect(payload.subject).toContain('STALE');
  });

  it('reports an error (not throw) on a non-ok Resend response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    const res = await sendHealthAlert(staleReport, fetchImpl as unknown as typeof fetch);
    expect(res.sent).toBe(false);
    expect(res.error).toContain('500');
  });

  it('reports an error (not throw) when fetch itself throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const res = await sendHealthAlert(staleReport, fetchImpl as unknown as typeof fetch);
    expect(res.sent).toBe(false);
    expect(res.error).toContain('network down');
  });
});
