import { NextResponse } from 'next/server';

/**
 * Rate limiter for public API routes.
 * Uses Upstash Redis when configured, falls back to in-memory store.
 */

// In-memory fallback (per-process, resets on cold start)
const memoryStore = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 5; // 5 requests per minute for public endpoints (subscribe/contact)
const MAX_REQUESTS_API = 60; // 60 requests per minute for public read-only API

function inMemoryLimit(identifier: string, max: number = MAX_REQUESTS): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = memoryStore.get(identifier);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return { success: true, remaining: max - 1 };
  }

  entry.count++;
  const remaining = Math.max(0, max - entry.count);
  return { success: entry.count <= max, remaining };
}

let rateLimiter: {
  limit: (identifier: string) => Promise<{ success: boolean; remaining: number }>;
} | null = null;

let initialized = false;

async function getRateLimiter() {
  if (initialized) return rateLimiter;
  initialized = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // Fall back to in-memory rate limiting
    rateLimiter = {
      limit: async (identifier: string) => inMemoryLimit(identifier),
    };
    return rateLimiter;
  }

  try {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');

    const redis = new Redis({ url, token });
    rateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(MAX_REQUESTS, '1 m'),
      analytics: false,
      prefix: 'distraction:api',
    });
    return rateLimiter;
  } catch (err) {
    console.error('[rate-limit] Failed to initialize Upstash, using in-memory:', err);
    rateLimiter = {
      limit: async (identifier: string) => inMemoryLimit(identifier),
    };
    return rateLimiter;
  }
}

/**
 * Check rate limit for the given IP. Returns a 429 response if exceeded,
 * or null if the request is allowed.
 */
export async function checkRateLimit(
  request: Request,
): Promise<NextResponse | null> {
  const limiter = await getRateLimiter();
  if (!limiter) return null;

  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'anonymous';

  const { success, remaining } = await limiter.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Remaining': String(remaining),
        },
      },
    );
  }

  return null;
}

/**
 * Rate limit for public read-only API routes (higher threshold).
 * 60 requests per minute per IP.
 */
export async function checkApiRateLimit(
  request: Request,
): Promise<NextResponse | null> {
  const forwarded = request?.headers?.get?.('x-forwarded-for') ?? null;
  const ip = forwarded?.split(',')[0]?.trim() || 'anonymous';
  const key = `api:${ip}`;

  const { success, remaining } = inMemoryLimit(key, MAX_REQUESTS_API);

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Remaining': String(remaining),
        },
      },
    );
  }

  return null;
}
