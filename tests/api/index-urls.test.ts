import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock google-indexing ──
const mockNotifyBatch = vi.fn();
const mockIsConfigured = vi.fn();

vi.mock('@/lib/google-indexing', () => ({
  notifyGoogleIndexingBatch: (...args: unknown[]) => mockNotifyBatch(...args),
  isGoogleIndexingConfigured: () => mockIsConfigured(),
}));

// ── Mock NextResponse/NextRequest ──
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
  NextRequest: class {
    url: string;
    private _headers: Map<string, string>;
    constructor(url: string, init?: { headers?: Record<string, string> }) {
      this.url = url;
      this._headers = new Map(Object.entries(init?.headers ?? {}));
    }
    get headers() {
      return { get: (key: string) => this._headers.get(key) ?? null };
    }
    async json() { return {}; }
  },
}));

function createRequest(body?: unknown, secret?: string) {
  const { NextRequest } = require('next/server');
  const headers: Record<string, string> = {};
  if (secret) headers['authorization'] = `Bearer ${secret}`;
  const req = new NextRequest('http://localhost/api/index-urls', { headers });
  if (body !== undefined) {
    req.json = async () => body;
  }
  return req;
}

describe('POST /api/index-urls', () => {
  let handler: (req: unknown) => Promise<{ status: number; json: () => Promise<unknown> }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
    mockIsConfigured.mockReturnValue(true);
    const mod = await import('@/app/api/index-urls/route');
    handler = mod.POST;
  });

  it('returns 401 without auth header', async () => {
    const req = createRequest({ urls: ['https://distractionindex.org'] });
    const res = await handler(req);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 with wrong secret', async () => {
    const req = createRequest({ urls: ['https://distractionindex.org'] }, 'wrong-secret');
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it('returns 503 when Google Indexing is not configured', async () => {
    mockIsConfigured.mockReturnValue(false);
    const req = createRequest({ urls: ['https://distractionindex.org'] }, 'test-cron-secret');
    const res = await handler(req);
    expect(res.status).toBe(503);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('not configured');
  });

  it('returns 400 when urls array is missing', async () => {
    const req = createRequest({}, 'test-cron-secret');
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('urls');
  });

  it('returns 400 when urls array is empty', async () => {
    const req = createRequest({ urls: [] }, 'test-cron-secret');
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when no valid URLs are provided', async () => {
    const req = createRequest({ urls: ['not-a-url', 'also-not-a-url'] }, 'test-cron-secret');
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('No valid URLs');
  });

  it('returns success with valid URLs', async () => {
    mockNotifyBatch.mockResolvedValue([
      { url: 'https://distractionindex.org/week/current', success: true },
    ]);

    const req = createRequest(
      { urls: ['https://distractionindex.org/week/current'] },
      'test-cron-secret',
    );
    const res = await handler(req);
    const body = await res.json() as { success: boolean; total: number; notified: number; failed: number };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.total).toBe(1);
    expect(body.notified).toBe(1);
    expect(body.failed).toBe(0);
  });

  it('filters out invalid URLs and only submits valid ones', async () => {
    mockNotifyBatch.mockResolvedValue([
      { url: 'https://distractionindex.org/week/current', success: true },
    ]);

    const req = createRequest(
      { urls: ['not-valid', 'https://distractionindex.org/week/current'] },
      'test-cron-secret',
    );
    const res = await handler(req);
    const body = await res.json() as { total: number };

    expect(res.status).toBe(200);
    expect(body.total).toBe(1);
    expect(mockNotifyBatch).toHaveBeenCalledWith(['https://distractionindex.org/week/current'], 'URL_UPDATED');
  });

  it('defaults to URL_UPDATED action', async () => {
    mockNotifyBatch.mockResolvedValue([
      { url: 'https://distractionindex.org/', success: true },
    ]);

    const req = createRequest(
      { urls: ['https://distractionindex.org/'] },
      'test-cron-secret',
    );
    await handler(req);

    expect(mockNotifyBatch).toHaveBeenCalledWith(
      expect.any(Array),
      'URL_UPDATED',
    );
  });

  it('uses URL_DELETED action when specified', async () => {
    mockNotifyBatch.mockResolvedValue([
      { url: 'https://distractionindex.org/old-page', success: true },
    ]);

    const req = createRequest(
      { urls: ['https://distractionindex.org/old-page'], action: 'URL_DELETED' },
      'test-cron-secret',
    );
    await handler(req);

    expect(mockNotifyBatch).toHaveBeenCalledWith(
      expect.any(Array),
      'URL_DELETED',
    );
  });

  it('reports failed URLs in results', async () => {
    mockNotifyBatch.mockResolvedValue([
      { url: 'https://distractionindex.org/page1', success: true },
      { url: 'https://distractionindex.org/page2', success: false, error: 'Quota exceeded' },
    ]);

    const req = createRequest(
      { urls: ['https://distractionindex.org/page1', 'https://distractionindex.org/page2'] },
      'test-cron-secret',
    );
    const res = await handler(req);
    const body = await res.json() as { notified: number; failed: number };

    expect(body.notified).toBe(1);
    expect(body.failed).toBe(1);
  });
});
