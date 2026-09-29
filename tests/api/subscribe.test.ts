import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFakeAdmin } from '../helpers/fake-admin';
import { hashConfirmationToken } from '@/lib/subscribers/confirmation';

// Mock the rate limiter so it never blocks test requests
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => null),
}));

// Mock the Supabase server client
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

// Mock the service-role client (token writes + duplicate lookups happen server-side)
const fake = createFakeAdmin();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => fake.client,
}));

// Resend is reached through global fetch
const mockFetch = vi.fn();

// Import after mocking
const { POST } = await import('@/app/api/subscribe/route');

describe('POST /api/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
    fake.calls.length = 0;
    // Default duplicate row: already confirmed.
    fake.results.select = { data: { id: 'sub-1', confirmed: true, unsubscribed_at: null, confirmation_sent_at: null }, error: null };
    fake.results.update = { error: null };
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', mockFetch);
    process.env.RESEND_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 400 for invalid email', async () => {
    const request = new Request('http://localhost/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.status).toBe('error');
    expect(data.message).toBe('Invalid email address');
  });

  it('returns 400 for missing email', async () => {
    const request = new Request('http://localhost/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.status).toBe('error');
  });

  it('returns subscribed on success', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });

    const request = new Request('http://localhost/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('subscribed');
    expect(mockFrom).toHaveBeenCalledWith('email_subscribers');
    expect(mockInsert).toHaveBeenCalledWith({ email: 'test@example.com' });
  });

  it('normalizes email to lowercase', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });

    const request = new Request('http://localhost/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'Test@Example.COM' }),
    });

    await POST(request);
    expect(mockInsert).toHaveBeenCalledWith({ email: 'test@example.com' });
  });

  it('returns already_subscribed on unique constraint violation', async () => {
    mockInsert.mockResolvedValueOnce({
      error: { code: '23505', message: 'duplicate key' },
    });

    const request = new Request('http://localhost/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'existing@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('already_subscribed');
  });

  it('returns 500 on other database errors', async () => {
    mockInsert.mockResolvedValueOnce({
      error: { code: '42P01', message: 'relation does not exist' },
    });

    const request = new Request('http://localhost/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.status).toBe('error');
  });

  it('returns 400 for invalid JSON body', async () => {
    const request = new Request('http://localhost/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.status).toBe('error');
  });
});

describe('POST /api/subscribe — double opt-in', () => {
  const MIN = 60_000;
  const post = (email: string) => POST(new Request('http://localhost/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }));
  const updates = () => fake.calls.filter((c) => c.kind === 'update');
  const sentToken = () => {
    const payload = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
    const m = /token=([A-Za-z0-9_-]+)/.exec(payload.text);
    return { payload, token: m?.[1] };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
    fake.calls.length = 0;
    fake.results.update = { error: null };
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', mockFetch);
    process.env.RESEND_API_KEY = 'test-key';
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('stores only the token HASH server-side and emails the raw token to the new subscriber', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });
    const res = await post('new@example.com');
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({ status: 'subscribed', confirmation: 'sent' });
    // Public insert is still just { email } — the anon client never writes tokens.
    expect(mockInsert).toHaveBeenCalledWith({ email: 'new@example.com' });

    const [u] = updates();
    expect(u.table).toBe('email_subscribers');
    expect(u.filters).toContainEqual(['email', 'new@example.com']);
    const vals = u.payload as { confirmation_token_hash: string; confirmation_sent_at: string };
    expect(vals.confirmation_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof vals.confirmation_sent_at).toBe('string');

    const { payload, token } = sentToken();
    expect(payload.to).toBe('new@example.com');
    expect(token).toBeTruthy();
    expect(hashConfirmationToken(token!)).toBe(vals.confirmation_token_hash);
  });

  it('writes the token before sending, so the emailed link always resolves', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });
    fake.results.update = { error: { message: 'write failed' } };
    const res = await post('new@example.com');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toMatchObject({ status: 'subscribed', confirmation: 'failed' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('still records the signup but reports confirmation "failed" when the email cannot be sent', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'resend down' });
    const res = await post('new@example.com');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toMatchObject({ status: 'subscribed', confirmation: 'failed' });
  });

  it('re-sends a fresh link when an UNCONFIRMED address subscribes again', async () => {
    mockInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } });
    fake.results.select = {
      data: { id: 'sub-1', confirmed: false, unsubscribed_at: null, confirmation_sent_at: new Date(Date.now() - 60 * MIN).toISOString() },
      error: null,
    };
    const res = await post('pending@example.com');
    const data = await res.json();
    expect(data).toMatchObject({ status: 'subscribed', confirmation: 'sent' });
    expect(updates()).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('does not re-send inside the 15-minute cooldown (anti mailbox-bombing)', async () => {
    mockInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } });
    fake.results.select = {
      data: { id: 'sub-1', confirmed: false, unsubscribed_at: null, confirmation_sent_at: new Date(Date.now() - 5 * MIN).toISOString() },
      error: null,
    };
    const res = await post('pending@example.com');
    const data = await res.json();
    expect(data).toMatchObject({ status: 'subscribed', confirmation: 'recently_sent' });
    expect(updates()).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends nothing for an already-CONFIRMED address', async () => {
    mockInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } });
    fake.results.select = { data: { id: 'sub-1', confirmed: true, unsubscribed_at: null, confirmation_sent_at: null }, error: null };
    const res = await post('done@example.com');
    const data = await res.json();
    expect(data.status).toBe('already_subscribed');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(updates()).toHaveLength(0);
  });

  it('sends nothing for an UNSUBSCRIBED address', async () => {
    mockInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } });
    fake.results.select = {
      data: { id: 'sub-1', confirmed: false, unsubscribed_at: new Date().toISOString(), confirmation_sent_at: null },
      error: null,
    };
    const res = await post('gone@example.com');
    const data = await res.json();
    expect(data.status).toBe('already_subscribed');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(updates()).toHaveLength(0);
  });
});
