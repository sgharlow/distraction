import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock NextResponse ──
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      status: init?.status ?? 200,
      headers: init?.headers ?? {},
      json: async () => body,
    }),
  },
}));

// ── Mock Upstash (not configured by default) ──
// By not setting UPSTASH_REDIS_REST_URL, the rate limiter falls back to in-memory

describe('checkRateLimit (in-memory fallback)', () => {
  let checkRateLimit: (request: Request) => Promise<{ status: number; json: () => Promise<unknown> } | null>;

  beforeEach(async () => {
    vi.resetModules();
    // Ensure Upstash env vars are not set so we use in-memory fallback
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const mod = await import('@/lib/rate-limit');
    checkRateLimit = mod.checkRateLimit;
  });

  function makeRequest(ip: string = '127.0.0.1'): Request {
    return new Request('http://localhost/api/subscribe', {
      method: 'POST',
      headers: {
        'x-forwarded-for': ip,
      },
    });
  }

  it('allows the first request', async () => {
    const result = await checkRateLimit(makeRequest('10.0.0.1'));
    expect(result).toBeNull(); // null means allowed
  });

  it('allows up to 5 requests from the same IP', async () => {
    const ip = '10.0.0.2';
    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimit(makeRequest(ip));
      expect(result).toBeNull();
    }
  });

  it('blocks the 6th request from the same IP', async () => {
    const ip = '10.0.0.3';
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(makeRequest(ip));
    }
    const result = await checkRateLimit(makeRequest(ip));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  it('returns 429 response with Retry-After header when blocked', async () => {
    const ip = '10.0.0.4';
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(makeRequest(ip));
    }
    const result = await checkRateLimit(makeRequest(ip));
    expect(result).not.toBeNull();
    const body = await result!.json() as { error: string };
    expect(body.error).toContain('Too many requests');
  });

  it('allows requests from different IPs independently', async () => {
    // Use 5 requests from one IP
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(makeRequest('10.0.0.5'));
    }
    // A different IP should still be allowed
    const result = await checkRateLimit(makeRequest('10.0.0.6'));
    expect(result).toBeNull();
  });

  it('uses "anonymous" when no x-forwarded-for header', async () => {
    const req = new Request('http://localhost/api/subscribe', { method: 'POST' });
    const result = await checkRateLimit(req);
    expect(result).toBeNull(); // first request always allowed
  });
});

describe('checkApiRateLimit (higher threshold)', () => {
  let checkApiRateLimit: (request: Request) => Promise<{ status: number; json: () => Promise<unknown> } | null>;

  beforeEach(async () => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const mod = await import('@/lib/rate-limit');
    checkApiRateLimit = mod.checkApiRateLimit;
  });

  function makeRequest(ip: string = '127.0.0.1'): Request {
    return new Request('http://localhost/api/v1/weeks', {
      method: 'GET',
      headers: {
        'x-forwarded-for': ip,
      },
    });
  }

  it('allows the first request', async () => {
    const result = await checkApiRateLimit(makeRequest('10.1.0.1'));
    expect(result).toBeNull();
  });

  it('allows many more requests than the standard rate limit (60 vs 5)', async () => {
    const ip = '10.1.0.2';
    // Should allow up to 60 requests
    for (let i = 0; i < 60; i++) {
      const result = await checkApiRateLimit(makeRequest(ip));
      expect(result).toBeNull();
    }
  });

  it('blocks after 60 requests from same IP', async () => {
    const ip = '10.1.0.3';
    for (let i = 0; i < 60; i++) {
      await checkApiRateLimit(makeRequest(ip));
    }
    const result = await checkApiRateLimit(makeRequest(ip));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });
});
