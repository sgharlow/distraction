import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase server client
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

// Import after mocking
const { POST } = await import('@/app/api/subscribe/route');

describe('POST /api/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
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
