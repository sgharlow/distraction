import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock pipeline functions ──
const mockRunIngestPipeline = vi.fn();
const mockRunProcessPipeline = vi.fn();

vi.mock('@/lib/ingestion/pipeline', () => ({
  runIngestPipeline: (...args: unknown[]) => mockRunIngestPipeline(...args),
  runProcessPipeline: (...args: unknown[]) => mockRunProcessPipeline(...args),
}));

// ── Mock Supabase admin client ──
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockSupabase = {
  from: mockFrom,
  rpc: mockRpc,
};

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockSupabase,
}));

// ── Mock weeks lib ──
vi.mock('@/lib/weeks', () => ({
  getCurrentWeekStart: () => new Date('2026-02-08'),
  toWeekId: (d: Date) => d.toISOString().split('T')[0],
}));

// ── Mock scoring service ──
vi.mock('@/lib/scoring/service', () => ({
  scoreEvent: vi.fn(),
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

// ── Helper to create mock request ──
function createRequest(url: string, secret?: string) {
  const headers = new Map<string, string>();
  if (secret) headers.set('authorization', `Bearer ${secret}`);
  return {
    url,
    headers: { get: (key: string) => headers.get(key) ?? null },
    json: async () => ({}),
  };
}

// ── Ingest route tests ──
describe('GET /api/ingest', () => {
  let handler: (req: unknown) => Promise<{ status: number; json: () => Promise<unknown> }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
    const mod = await import('@/app/api/ingest/route');
    handler = mod.GET;
  });

  it('returns 401 without auth header', async () => {
    const req = createRequest('http://localhost/api/ingest');
    const res = await handler(req);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 with wrong secret', async () => {
    const req = createRequest('http://localhost/api/ingest', 'wrong-secret');
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it('returns success with valid auth', async () => {
    mockRunIngestPipeline.mockResolvedValue({
      articles_fetched: 25,
      articles_stored: 18,
      sources: ['gdelt', 'gnews'],
    });

    const req = createRequest('http://localhost/api/ingest', 'test-cron-secret');
    const res = await handler(req);
    const body = await res.json() as { success: boolean; articles_fetched: number };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.articles_fetched).toBe(25);
  });

  it('returns 500 on pipeline error', async () => {
    mockRunIngestPipeline.mockRejectedValue(new Error('GDELT timeout'));

    const req = createRequest('http://localhost/api/ingest', 'test-cron-secret');
    const res = await handler(req);
    const body = await res.json() as { success: boolean; error: string };

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('GDELT timeout');
  });
});

// ── Process route tests ──
describe('GET /api/process', () => {
  let handler: (req: unknown) => Promise<{ status: number; json: () => Promise<unknown> }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
    const mod = await import('@/app/api/process/route');
    handler = mod.GET;
  });

  it('returns 401 without auth', async () => {
    const req = createRequest('http://localhost/api/process');
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it('returns success with valid auth', async () => {
    mockRunProcessPipeline.mockResolvedValue({
      events_clustered: 3,
      events_scored: 2,
      smokescreen_pairs: 1,
    });

    const req = createRequest('http://localhost/api/process', 'test-cron-secret');
    const res = await handler(req);
    const body = await res.json() as { success: boolean; events_scored: number };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.events_scored).toBe(2);
  });

  it('returns 500 on pipeline error', async () => {
    mockRunProcessPipeline.mockRejectedValue(new Error('Claude API rate limit'));

    const req = createRequest('http://localhost/api/process', 'test-cron-secret');
    const res = await handler(req);
    const body = await res.json() as { success: boolean; error: string };

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Claude API rate limit');
  });
});

// ── Freeze route tests ──
describe('GET /api/freeze', () => {
  let handler: (req: unknown) => Promise<{ status: number; json: () => Promise<unknown> }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
    const mod = await import('@/app/api/freeze/route');
    handler = mod.GET;
  });

  it('returns 401 without auth', async () => {
    const req = createRequest('http://localhost/api/freeze');
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it('returns success when no previous week data exists', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    const req = createRequest('http://localhost/api/freeze', 'test-cron-secret');
    const res = await handler(req);
    const body = await res.json() as { success: boolean; message: string };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('nothing to freeze');
  });

  it('returns success when week already frozen', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { week_id: '2026-02-01', status: 'frozen' },
          }),
        }),
      }),
    });

    const req = createRequest('http://localhost/api/freeze', 'test-cron-secret');
    const res = await handler(req);
    const body = await res.json() as { success: boolean; message: string };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('already frozen');
  });
});

// ── Score route tests ──
describe('POST /api/score', () => {
  let handler: (req: unknown) => Promise<{ status: number; json: () => Promise<unknown> }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
    const mod = await import('@/app/api/score/route');
    handler = mod.POST;
  });

  it('returns 401 without auth', async () => {
    const req = createRequest('http://localhost/api/score');
    req.json = async () => ({ event_id: 'evt-001' });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when event_id missing', async () => {
    const req = createRequest('http://localhost/api/score', 'test-cron-secret');
    req.json = async () => ({});
    const res = await handler(req);
    const body = await res.json() as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe('event_id required');
  });

  it('returns 404 when event not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
        }),
      }),
    });

    const req = createRequest('http://localhost/api/score', 'test-cron-secret');
    req.json = async () => ({ event_id: 'nonexistent' });
    const res = await handler(req);

    expect(res.status).toBe(404);
  });

  it('returns 409 when event is frozen', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'evt-001', score_frozen: true },
            error: null,
          }),
        }),
      }),
    });

    const req = createRequest('http://localhost/api/score', 'test-cron-secret');
    req.json = async () => ({ event_id: 'evt-001' });
    const res = await handler(req);

    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('frozen');
  });
});
