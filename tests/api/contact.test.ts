import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the rate limiter so it never blocks test requests
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => null),
}));

// Mock the Supabase admin client
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

// Import after mocking
const { POST } = await import('@/app/api/contact/route');

describe('POST /api/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it('returns 400 for missing name', async () => {
    const request = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', message: 'Hello there, this is a message' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.status).toBe('error');
    expect(data.message).toBe('Name is required');
  });

  it('returns 400 for name shorter than 2 characters', async () => {
    const request = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'A', email: 'test@example.com', message: 'Hello there, this is a message' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Name is required');
  });

  it('returns 400 for invalid email', async () => {
    const request = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email: 'not-an-email', message: 'Hello there, this is a message' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid email address');
  });

  it('returns 400 for missing email', async () => {
    const request = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', message: 'Hello there, this is a message' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid email address');
  });

  it('returns 400 for message shorter than 10 characters', async () => {
    const request = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email: 'test@example.com', message: 'Short' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Message must be at least 10 characters');
  });

  it('returns 400 for message longer than 5000 characters', async () => {
    const request = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        message: 'x'.repeat(5001),
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Message is too long');
  });

  it('returns success on valid submission', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });

    const request = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        message: 'This is a valid message with enough characters.',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('sent');
    expect(mockFrom).toHaveBeenCalledWith('contact_submissions');
  });

  it('normalizes email to lowercase', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });

    const request = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'Test@Example.COM',
        message: 'This is a valid message for testing.',
      }),
    });

    await POST(request);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' }),
    );
  });

  it('trims whitespace from name', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });

    const request = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '  Test User  ',
        email: 'test@example.com',
        message: 'This is a valid message for testing.',
      }),
    });

    await POST(request);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test User' }),
    );
  });

  it('returns 500 on database error', async () => {
    mockInsert.mockResolvedValueOnce({
      error: { message: 'DB connection lost' },
    });

    const request = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        message: 'This is a valid message for testing.',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.status).toBe('error');
    expect(data.message).toBe('Submission failed');
  });

  it('returns 400 for invalid JSON body', async () => {
    const request = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.status).toBe('error');
    expect(data.message).toBe('Invalid request');
  });
});
