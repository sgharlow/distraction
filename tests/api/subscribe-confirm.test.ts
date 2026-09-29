import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeAdmin } from '../helpers/fake-admin';
import { generateConfirmationToken, hashConfirmationToken } from '@/lib/subscribers/confirmation';

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => null),
}));

const fake = createFakeAdmin();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => fake.client,
}));

const { GET } = await import('@/app/api/subscribe/confirm/route');

const HOUR = 3_600_000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

function req(token?: string) {
  const qs = token === undefined ? '' : `?token=${encodeURIComponent(token)}`;
  return new Request(`http://localhost/api/subscribe/confirm${qs}`);
}

function pendingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    confirmed: false,
    unsubscribed_at: null,
    confirmation_sent_at: iso(1 * HOUR),
    ...overrides,
  };
}

const updates = () => fake.calls.filter((c) => c.kind === 'update');

describe('GET /api/subscribe/confirm', () => {
  beforeEach(() => {
    fake.calls.length = 0;
    fake.results.select = { data: pendingRow(), error: null };
    fake.results.update = { error: null };
  });

  it('confirms a pending subscriber server-side and says so in plain HTML', async () => {
    const token = generateConfirmationToken();
    const res = await GET(req(token));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(await res.text()).toMatch(/subscription confirmed/i);

    const [u] = updates();
    expect(u.table).toBe('email_subscribers');
    expect(u.payload).toMatchObject({ confirmed: true });
    expect(typeof (u.payload as { confirmed_at: string }).confirmed_at).toBe('string');
    // Scoped to the row found, and only if still unconfirmed (idempotent).
    expect(u.filters).toContainEqual(['id', 'sub-1']);
    expect(u.filters).toContainEqual(['confirmed', false]);
  });

  it('looks the row up by the token HASH, never the raw token', async () => {
    const token = generateConfirmationToken();
    await GET(req(token));
    const lookup = fake.calls.find((c) => c.kind === 'select')!;
    expect(lookup.filters).toContainEqual(['confirmation_token_hash', hashConfirmationToken(token)]);
    expect(JSON.stringify(lookup.filters)).not.toContain(token);
  });

  it('rejects a missing token with 400 and no DB access', async () => {
    const res = await GET(req());
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/invalid/i);
    expect(fake.calls).toHaveLength(0);
  });

  it('rejects a malformed token with 400 and no DB access', async () => {
    const res = await GET(req('not a token'));
    expect(res.status).toBe(400);
    expect(fake.calls).toHaveLength(0);
  });

  it('returns 404 for an unknown token', async () => {
    fake.results.select = { data: null, error: null };
    const res = await GET(req(generateConfirmationToken()));
    expect(res.status).toBe(404);
    expect(await res.text()).toMatch(/not valid/i);
    expect(updates()).toHaveLength(0);
  });

  it('is idempotent for an already-confirmed subscriber (200, no write)', async () => {
    fake.results.select = { data: pendingRow({ confirmed: true }), error: null };
    const res = await GET(req(generateConfirmationToken()));
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/already confirmed/i);
    expect(updates()).toHaveLength(0);
  });

  it('refuses to confirm an unsubscribed row (410, no write)', async () => {
    fake.results.select = { data: pendingRow({ unsubscribed_at: iso(2 * HOUR) }), error: null };
    const res = await GET(req(generateConfirmationToken()));
    expect(res.status).toBe(410);
    expect(await res.text()).toMatch(/unsubscribed/i);
    expect(updates()).toHaveLength(0);
  });

  it('refuses an expired link (older than 7 days) with 410 and tells the reader to subscribe again', async () => {
    fake.results.select = { data: pendingRow({ confirmation_sent_at: iso(8 * 24 * HOUR) }), error: null };
    const res = await GET(req(generateConfirmationToken()));
    expect(res.status).toBe(410);
    expect(await res.text()).toMatch(/expired/i);
    expect(updates()).toHaveLength(0);
  });

  it('treats a row with no sent timestamp as expired (fail closed)', async () => {
    fake.results.select = { data: pendingRow({ confirmation_sent_at: null }), error: null };
    const res = await GET(req(generateConfirmationToken()));
    expect(res.status).toBe(410);
    expect(updates()).toHaveLength(0);
  });

  it('returns 500 when the lookup fails', async () => {
    fake.results.select = { data: null, error: { message: 'db down' } };
    const res = await GET(req(generateConfirmationToken()));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('db down');
  });

  it('returns 500 when the confirm write fails', async () => {
    fake.results.update = { error: { message: 'write failed' } };
    const res = await GET(req(generateConfirmationToken()));
    expect(res.status).toBe(500);
  });
});
