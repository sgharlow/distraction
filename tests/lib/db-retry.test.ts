import { describe, it, expect, vi } from 'vitest';
import { withDbRetry, isTransientDbError } from '@/lib/supabase/retry';

// ── Fixture: a fake PostgREST result shape ({ data, error }) ──
const ok = { data: [{ id: 1 }], error: null };
const gatewayTimeout = { data: null, error: { message: 'Gateway Timeout', code: '504' } };
const paused = { data: null, error: { message: 'Database is paused', code: 'PGRST000' } };

const noSleep = vi.fn(async () => {});

describe('isTransientDbError', () => {
  it('classifies the 2026-09-12 Supabase signature (Gateway Timeout / 5xx) as transient', () => {
    expect(isTransientDbError({ message: 'Gateway Timeout', code: '504' })).toBe(true);
    expect(isTransientDbError({ message: 'Bad Gateway', code: '502' })).toBe(true);
    expect(isTransientDbError({ message: 'Service Unavailable', code: '503' })).toBe(true);
    expect(isTransientDbError(new Error('fetch failed'))).toBe(true);
    expect(isTransientDbError(new Error('connect ECONNRESET'))).toBe(true);
  });

  it('does NOT classify application / auth / paused errors as transient', () => {
    expect(isTransientDbError({ message: 'Database is paused', code: 'PGRST000' })).toBe(false);
    expect(isTransientDbError({ message: 'JWT expired', code: 'PGRST301' })).toBe(false);
    expect(isTransientDbError({ message: 'relation does not exist', code: '42P01' })).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
  });
});

describe('withDbRetry', () => {
  it('returns the first result untouched when it succeeds (one call, no sleep)', async () => {
    const op = vi.fn(async () => ok);
    const sleep = vi.fn(async () => {});
    const result = await withDbRetry(op, { sleep });
    expect(result).toBe(ok);
    expect(op).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a transient Gateway Timeout and returns the successful retry', async () => {
    const op = vi.fn().mockResolvedValueOnce(gatewayTimeout).mockResolvedValueOnce(ok);
    const sleep = vi.fn(async () => {});
    const result = await withDbRetry(op, { sleep, delaysMs: [1000, 3000] });
    expect(result).toBe(ok);
    expect(op).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it('gives up after the configured attempts and returns the LAST error result (fail-closed stays intact)', async () => {
    const op = vi.fn(async () => gatewayTimeout);
    const sleep = vi.fn(async () => {});
    const result = await withDbRetry(op, { sleep, delaysMs: [1000, 3000] });
    expect(result).toBe(gatewayTimeout);
    expect(op).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(2, 3000);
  });

  it('does not retry a non-transient error (paused project, bad query) — returns it immediately', async () => {
    const op = vi.fn(async () => paused);
    const result = await withDbRetry(op, { sleep: noSleep });
    expect(result).toBe(paused);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retries a THROWN transient network error and rethrows after exhausting attempts', async () => {
    const op = vi.fn(async () => { throw new Error('fetch failed'); });
    await expect(withDbRetry(op, { sleep: noSleep, delaysMs: [1, 1] })).rejects.toThrow('fetch failed');
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('rethrows a thrown NON-transient error immediately without retrying', async () => {
    const op = vi.fn(async () => { throw new Error('createAdminClient: SUPABASE_SERVICE_ROLE_KEY missing'); });
    await expect(withDbRetry(op, { sleep: noSleep })).rejects.toThrow('SUPABASE_SERVICE_ROLE_KEY');
    expect(op).toHaveBeenCalledTimes(1);
  });
});
