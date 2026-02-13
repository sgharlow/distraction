import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the data layer ──
const mockGetAllWeekSnapshots = vi.fn();
const mockGetWeekData = vi.fn();

vi.mock('@/lib/data/weeks', () => ({
  getAllWeekSnapshots: (...args: unknown[]) => mockGetAllWeekSnapshots(...args),
  getWeekData: (...args: unknown[]) => mockGetWeekData(...args),
}));

// ── Mock NextResponse (avoid full Next.js server dependency) ──
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
  NextRequest: class {
    url: string;
    constructor(url: string) { this.url = url; }
  },
}));

// ── Sample data fixtures ──
const sampleSnapshot = {
  id: 'snap-001',
  week_id: '2026-02-08',
  week_start: '2026-02-08',
  week_end: '2026-02-14',
  status: 'live' as const,
  frozen_at: null,
  total_events: 42,
  list_a_count: 5,
  list_b_count: 19,
  list_c_count: 18,
  avg_a_score: 9.14,
  avg_b_score: 23.68,
  max_smokescreen_index: 0.85,
  top_smokescreen_pair: null,
  week_attention_budget: 67.5,
  total_sources: 751,
  primary_doc_count: 3,
  weekly_summary: null,
};

const frozenSnapshot = {
  ...sampleSnapshot,
  id: 'snap-002',
  week_id: '2026-02-01',
  week_start: '2026-02-01',
  week_end: '2026-02-07',
  status: 'frozen' as const,
  frozen_at: '2026-02-08T05:00:00Z',
  total_events: 38,
  list_a_count: 4,
  list_b_count: 15,
  list_c_count: 19,
};

const sampleEvent = {
  id: 'evt-001',
  title: 'Executive Order on Immigration',
  event_date: '2026-02-10',
  primary_list: 'A',
  a_score: 42.5,
  b_score: 12.3,
  attention_budget: 8.5,
  mechanism_of_harm: 'policy_change',
  summary: 'New executive order restricting visa processing.',
  article_count: 15,
  action_item: 'Contact your representative.',
  noise_score: null,
};

const sampleEventB = {
  ...sampleEvent,
  id: 'evt-002',
  title: 'Celebrity Social Media Feud',
  primary_list: 'B',
  a_score: 3.2,
  b_score: 45.7,
  attention_budget: 15.2,
  mechanism_of_harm: null,
  summary: 'High-profile social media dispute dominates news cycle.',
  article_count: 42,
  action_item: null,
  noise_score: null,
};

const sampleSmokescreenPair = {
  id: 'pair-001',
  week_id: '2026-02-08',
  smokescreen_index: 0.85,
  displacement_confidence: 0.72,
  distraction_event_id: 'evt-002',
  damage_event_id: 'evt-001',
  evidence_notes: 'Timing overlap within 4 hours.',
  distraction_event: { id: 'evt-002', title: 'Celebrity Social Media Feud', a_score: 3.2, b_score: 45.7 },
  damage_event: { id: 'evt-001', title: 'Executive Order on Immigration', a_score: 42.5, b_score: 12.3 },
};

// ── Tests ──

describe('GET /api/v1/weeks', () => {
  let handler: () => Promise<{ status: number; json: () => Promise<unknown> }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/v1/weeks/route');
    handler = mod.GET;
  });

  it('returns an array of weeks with count', async () => {
    mockGetAllWeekSnapshots.mockResolvedValue([sampleSnapshot, frozenSnapshot]);

    const res = await handler();
    const body = await res.json() as { count: number; weeks: unknown[] };

    expect(res.status).toBe(200);
    expect(body.count).toBe(2);
    expect(body.weeks).toHaveLength(2);
  });

  it('returns correct week shape for each item', async () => {
    mockGetAllWeekSnapshots.mockResolvedValue([sampleSnapshot]);

    const res = await handler();
    const body = await res.json() as { weeks: Record<string, unknown>[] };
    const week = body.weeks[0];

    // Verify all expected fields are present
    expect(week).toHaveProperty('week_id', '2026-02-08');
    expect(week).toHaveProperty('week_start', '2026-02-08');
    expect(week).toHaveProperty('week_end', '2026-02-14');
    expect(week).toHaveProperty('status', 'live');
    expect(week).toHaveProperty('frozen_at', null);
    expect(week).toHaveProperty('total_events', 42);
    expect(week).toHaveProperty('list_a_count', 5);
    expect(week).toHaveProperty('list_b_count', 19);
    expect(week).toHaveProperty('list_c_count', 18);
    expect(week).toHaveProperty('avg_a_score', 9.14);
    expect(week).toHaveProperty('avg_b_score', 23.68);
    expect(week).toHaveProperty('max_smokescreen_index', 0.85);
    expect(week).toHaveProperty('week_attention_budget', 67.5);
    expect(week).toHaveProperty('total_sources', 751);
  });

  it('does not leak internal fields (id, weekly_summary, primary_doc_count)', async () => {
    mockGetAllWeekSnapshots.mockResolvedValue([sampleSnapshot]);

    const res = await handler();
    const body = await res.json() as { weeks: Record<string, unknown>[] };
    const week = body.weeks[0];

    expect(week).not.toHaveProperty('id');
    expect(week).not.toHaveProperty('weekly_summary');
    expect(week).not.toHaveProperty('primary_doc_count');
  });

  it('returns empty array when no weeks exist', async () => {
    mockGetAllWeekSnapshots.mockResolvedValue([]);

    const res = await handler();
    const body = await res.json() as { count: number; weeks: unknown[] };

    expect(body.count).toBe(0);
    expect(body.weeks).toEqual([]);
  });

  it('includes frozen_at for frozen weeks', async () => {
    mockGetAllWeekSnapshots.mockResolvedValue([frozenSnapshot]);

    const res = await handler();
    const body = await res.json() as { weeks: Record<string, unknown>[] };

    expect(body.weeks[0].status).toBe('frozen');
    expect(body.weeks[0].frozen_at).toBe('2026-02-08T05:00:00Z');
  });
});

describe('GET /api/v1/weeks/:weekId/events', () => {
  let handler: (req: unknown, ctx: { params: Promise<{ weekId: string }> }) => Promise<{ status: number; json: () => Promise<unknown> }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/v1/weeks/[weekId]/events/route');
    handler = mod.GET;
  });

  it('returns events grouped by list A/B/C', async () => {
    mockGetWeekData.mockResolvedValue({
      snapshot: sampleSnapshot,
      events: {
        A: [sampleEvent],
        B: [sampleEventB],
        C: [],
      },
      smokescreenPairs: [sampleSmokescreenPair],
    });

    const res = await handler(
      {},
      { params: Promise.resolve({ weekId: '2026-02-08' }) },
    );
    const body = await res.json() as {
      week_id: string;
      status: string;
      total_events: number;
      events: { A: unknown[]; B: unknown[]; C: unknown[] };
      smokescreen_pairs: unknown[];
    };

    expect(res.status).toBe(200);
    expect(body.week_id).toBe('2026-02-08');
    expect(body.status).toBe('live');
    expect(body.total_events).toBe(2);
    expect(body.events.A).toHaveLength(1);
    expect(body.events.B).toHaveLength(1);
    expect(body.events.C).toHaveLength(0);
  });

  it('returns correct event shape', async () => {
    mockGetWeekData.mockResolvedValue({
      snapshot: sampleSnapshot,
      events: { A: [sampleEvent], B: [], C: [] },
      smokescreenPairs: [],
    });

    const res = await handler(
      {},
      { params: Promise.resolve({ weekId: '2026-02-08' }) },
    );
    const body = await res.json() as { events: { A: Record<string, unknown>[] } };
    const event = body.events.A[0];

    expect(event).toHaveProperty('id', 'evt-001');
    expect(event).toHaveProperty('title', 'Executive Order on Immigration');
    expect(event).toHaveProperty('event_date', '2026-02-10');
    expect(event).toHaveProperty('primary_list', 'A');
    expect(event).toHaveProperty('a_score', 42.5);
    expect(event).toHaveProperty('b_score', 12.3);
    expect(event).toHaveProperty('attention_budget', 8.5);
    expect(event).toHaveProperty('mechanism_of_harm', 'policy_change');
    expect(event).toHaveProperty('summary');
    expect(event).toHaveProperty('article_count', 15);
    expect(event).toHaveProperty('action_item');
  });

  it('returns smokescreen pairs with correct shape', async () => {
    mockGetWeekData.mockResolvedValue({
      snapshot: sampleSnapshot,
      events: { A: [sampleEvent], B: [sampleEventB], C: [] },
      smokescreenPairs: [sampleSmokescreenPair],
    });

    const res = await handler(
      {},
      { params: Promise.resolve({ weekId: '2026-02-08' }) },
    );
    const body = await res.json() as { smokescreen_pairs: Record<string, unknown>[] };
    const pair = body.smokescreen_pairs[0];

    expect(pair).toHaveProperty('id', 'pair-001');
    expect(pair).toHaveProperty('smokescreen_index', 0.85);
    expect(pair).toHaveProperty('displacement_confidence', 0.72);
    expect(pair).toHaveProperty('distraction_event_id', 'evt-002');
    expect(pair).toHaveProperty('distraction_title', 'Celebrity Social Media Feud');
    expect(pair).toHaveProperty('damage_event_id', 'evt-001');
    expect(pair).toHaveProperty('damage_title', 'Executive Order on Immigration');
    expect(pair).toHaveProperty('evidence_notes');
  });

  it('returns 404 for non-existent week', async () => {
    mockGetWeekData.mockResolvedValue(null);

    const res = await handler(
      {},
      { params: Promise.resolve({ weekId: '2099-01-01' }) },
    );
    const body = await res.json() as { error: string; week_id: string };

    expect(res.status).toBe(404);
    expect(body.error).toBe('Week not found');
    expect(body.week_id).toBe('2099-01-01');
  });

  it('returns empty events arrays for a week with no events', async () => {
    mockGetWeekData.mockResolvedValue({
      snapshot: { ...sampleSnapshot, total_events: 0 },
      events: { A: [], B: [], C: [] },
      smokescreenPairs: [],
    });

    const res = await handler(
      {},
      { params: Promise.resolve({ weekId: '2026-02-08' }) },
    );
    const body = await res.json() as { total_events: number; events: { A: unknown[]; B: unknown[]; C: unknown[] } };

    expect(body.total_events).toBe(0);
    expect(body.events.A).toEqual([]);
    expect(body.events.B).toEqual([]);
    expect(body.events.C).toEqual([]);
  });
});
