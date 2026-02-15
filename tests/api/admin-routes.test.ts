import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock admin auth ──
const mockGetAdminUser = vi.fn();

vi.mock('@/lib/admin-auth', () => ({
  getAdminUser: () => mockGetAdminUser(),
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

// ── Mock classify (used by admin event PATCH) ──
vi.mock('@/lib/scoring/classify', () => ({
  classifyEvent: vi.fn().mockReturnValue({
    primary_list: 'A',
    is_mixed: false,
    noise_flag: false,
  }),
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
    nextUrl: { searchParams: URLSearchParams };
    private _headers: Map<string, string>;
    constructor(url: string) {
      this.url = url;
      this.nextUrl = { searchParams: new URL(url, 'http://localhost').searchParams };
      this._headers = new Map();
    }
    get headers() {
      return { get: (key: string) => this._headers.get(key) ?? null };
    }
    async json() { return {}; }
  },
}));

// ── Helpers ──
function createAdminRequest(url: string, body?: unknown) {
  const req = {
    url,
    nextUrl: { searchParams: new URL(url, 'http://localhost').searchParams },
    headers: { get: () => null },
    json: async () => body ?? {},
  };
  return req;
}

const mockAdminUser = { id: 'admin-001', email: 'admin@test.com' };

// Supabase chain builder for common patterns
function mockSelectChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({ data, error, count: Array.isArray(data) ? data.length : 0 }),
        limit: vi.fn().mockResolvedValue({ data, error }),
      }),
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error }),
        order: vi.fn().mockResolvedValue({ data, error }),
        neq: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  };
}

// ═══════════════════════════════════════════════════════════
// GET /api/admin/events
// ═══════════════════════════════════════════════════════════
describe('GET /api/admin/events', () => {
  let handler: (req: unknown) => Promise<{ status: number; json: () => Promise<unknown> }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/admin/events/route');
    handler = mod.GET;
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const req = createAdminRequest('http://localhost/api/admin/events');
    const res = await handler(req);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Unauthorized');
  });

  it('returns events list when authenticated', async () => {
    mockGetAdminUser.mockResolvedValue(mockAdminUser);
    const events = [
      { id: 'evt-001', title: 'Test Event', primary_list: 'A', a_score: 42 },
      { id: 'evt-002', title: 'Test Event 2', primary_list: 'B', b_score: 35 },
    ];

    mockFrom.mockReturnValue(mockSelectChain(events));

    const req = createAdminRequest('http://localhost/api/admin/events');
    const res = await handler(req);
    const body = await res.json() as { events: unknown[]; count: number };

    expect(res.status).toBe(200);
    expect(body.events).toHaveLength(2);
  });

  it('returns 500 on database error', async () => {
    mockGetAdminUser.mockResolvedValue(mockAdminUser);
    mockFrom.mockReturnValue(mockSelectChain(null, { message: 'DB connection lost' }));

    const req = createAdminRequest('http://localhost/api/admin/events');
    const res = await handler(req);

    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('DB connection lost');
  });
});

// ═══════════════════════════════════════════════════════════
// PATCH /api/admin/events (bulk actions)
// ═══════════════════════════════════════════════════════════
describe('PATCH /api/admin/events', () => {
  let handler: (req: unknown) => Promise<{ status: number; json: () => Promise<unknown> }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/admin/events/route');
    handler = mod.PATCH;
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const req = createAdminRequest('http://localhost/api/admin/events', {
      event_ids: ['evt-001'],
      action: 'mark_reviewed',
    });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when event_ids missing', async () => {
    mockGetAdminUser.mockResolvedValue(mockAdminUser);
    const req = createAdminRequest('http://localhost/api/admin/events', {
      action: 'mark_reviewed',
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('event_ids required');
  });

  it('returns 400 for unknown action', async () => {
    mockGetAdminUser.mockResolvedValue(mockAdminUser);
    const req = createAdminRequest('http://localhost/api/admin/events', {
      event_ids: ['evt-001'],
      action: 'invalid_action',
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Unknown action');
  });

  it('marks events as reviewed with valid request', async () => {
    mockGetAdminUser.mockResolvedValue(mockAdminUser);
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const req = createAdminRequest('http://localhost/api/admin/events', {
      event_ids: ['evt-001', 'evt-002'],
      action: 'mark_reviewed',
    });
    const res = await handler(req);
    const body = await res.json() as { success: boolean; updated: number };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.updated).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════
// GET /api/admin/events/[eventId]
// ═══════════════════════════════════════════════════════════
describe('GET /api/admin/events/[eventId]', () => {
  let handler: (
    req: unknown,
    ctx: { params: Promise<{ eventId: string }> },
  ) => Promise<{ status: number; json: () => Promise<unknown> }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/admin/events/[eventId]/route');
    handler = mod.GET;
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const req = createAdminRequest('http://localhost/api/admin/events/evt-001');
    const res = await handler(req, { params: Promise.resolve({ eventId: 'evt-001' }) });
    expect(res.status).toBe(401);
  });

  it('returns event detail with score changes and articles', async () => {
    mockGetAdminUser.mockResolvedValue(mockAdminUser);
    const event = { id: 'evt-001', title: 'Test Event', a_score: 42, b_score: 12 };
    const scoreChanges = [{ id: 'sc-001', change_type: 'rescore' }];
    const articles = [{ id: 'art-001', headline: 'Breaking News' }];

    // Mock three parallel queries (events, score_changes, articles)
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      callCount++;
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: event, error: null }),
            }),
          }),
        };
      }
      if (table === 'score_changes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: scoreChanges }),
            }),
          }),
        };
      }
      // articles
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: articles }),
          }),
        }),
      };
    });

    const req = createAdminRequest('http://localhost/api/admin/events/evt-001');
    const res = await handler(req, { params: Promise.resolve({ eventId: 'evt-001' }) });
    const body = await res.json() as { event: unknown; score_changes: unknown[]; articles: unknown[] };

    expect(res.status).toBe(200);
    expect(body.event).toEqual(event);
    expect(body.score_changes).toHaveLength(1);
    expect(body.articles).toHaveLength(1);
  });

  it('returns 404 when event not found', async () => {
    mockGetAdminUser.mockResolvedValue(mockAdminUser);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          order: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });

    const req = createAdminRequest('http://localhost/api/admin/events/nonexistent');
    const res = await handler(req, { params: Promise.resolve({ eventId: 'nonexistent' }) });

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════
// GET /api/admin/weeks
// ═══════════════════════════════════════════════════════════
describe('GET /api/admin/weeks', () => {
  let handler: (req: unknown) => Promise<{ status: number; json: () => Promise<unknown> }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/admin/weeks/route');
    handler = mod.GET;
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const req = createAdminRequest('http://localhost/api/admin/weeks');
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it('returns weeks list when authenticated', async () => {
    mockGetAdminUser.mockResolvedValue(mockAdminUser);
    const weeks = [
      { week_id: '2026-02-08', status: 'live', total_events: 42 },
      { week_id: '2026-02-01', status: 'frozen', total_events: 38 },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: weeks, error: null }),
      }),
    });

    const req = createAdminRequest('http://localhost/api/admin/weeks');
    const res = await handler(req);
    const body = await res.json() as { weeks: unknown[] };

    expect(res.status).toBe(200);
    expect(body.weeks).toHaveLength(2);
    expect(body.weeks[0]).toHaveProperty('week_id', '2026-02-08');
  });

  it('returns empty array when no weeks exist', async () => {
    mockGetAdminUser.mockResolvedValue(mockAdminUser);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const req = createAdminRequest('http://localhost/api/admin/weeks');
    const res = await handler(req);
    const body = await res.json() as { weeks: unknown[] };

    expect(res.status).toBe(200);
    expect(body.weeks).toEqual([]);
  });

  it('returns 500 on database error', async () => {
    mockGetAdminUser.mockResolvedValue(mockAdminUser);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Connection timeout' } }),
      }),
    });

    const req = createAdminRequest('http://localhost/api/admin/weeks');
    const res = await handler(req);

    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Connection timeout');
  });
});

// ═══════════════════════════════════════════════════════════
// GET /api/admin/pipeline
// ═══════════════════════════════════════════════════════════
describe('GET /api/admin/pipeline', () => {
  let handler: (req: unknown) => Promise<{ status: number; json: () => Promise<unknown> }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/admin/pipeline/route');
    handler = mod.GET;
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const req = createAdminRequest('http://localhost/api/admin/pipeline');
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it('returns pipeline runs when authenticated', async () => {
    mockGetAdminUser.mockResolvedValue(mockAdminUser);
    const runs = [
      { id: 'run-001', run_type: 'ingest', status: 'completed' },
      { id: 'run-002', run_type: 'process', status: 'completed' },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: runs, error: null }),
        }),
      }),
    });

    const req = createAdminRequest('http://localhost/api/admin/pipeline');
    const res = await handler(req);
    const body = await res.json() as { runs: unknown[] };

    expect(res.status).toBe(200);
    expect(body.runs).toHaveLength(2);
  });
});
