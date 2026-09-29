import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateConfirmationToken,
  hashConfirmationToken,
  isWellFormedToken,
  confirmationUrl,
  sendConfirmationEmail,
  CONFIRMATION_TTL_HOURS,
} from '@/lib/subscribers/confirmation';

const ORIGINAL = {
  key: process.env.RESEND_API_KEY,
  site: process.env.NEXT_PUBLIC_SITE_URL,
  from: process.env.OUTREACH_FROM_EMAIL,
};

describe('confirmation tokens', () => {
  it('generates URL-safe tokens with 256 bits of entropy', () => {
    const t = generateConfirmationToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('never repeats a token', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateConfirmationToken()));
    expect(seen.size).toBe(200);
  });

  it('hashes deterministically to SHA-256 hex, and the hash is not the token', () => {
    const t = generateConfirmationToken();
    const h = hashConfirmationToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashConfirmationToken(t)).toBe(h);
    expect(h).not.toContain(t);
    expect(hashConfirmationToken(generateConfirmationToken())).not.toBe(h);
  });

  it('accepts only well-formed tokens', () => {
    expect(isWellFormedToken(generateConfirmationToken())).toBe(true);
    expect(isWellFormedToken('')).toBe(false);
    expect(isWellFormedToken(null)).toBe(false);
    expect(isWellFormedToken('short')).toBe(false);
    expect(isWellFormedToken(`${'a'.repeat(42)}!`)).toBe(false);
  });

  it('expires links after 7 days', () => {
    expect(CONFIRMATION_TTL_HOURS).toBe(168);
  });
});

describe('confirmationUrl', () => {
  afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL.site; });

  it('points at the confirm route on the configured site, URL-encoding the token', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.org';
    expect(confirmationUrl('abc_DEF-123')).toBe('https://example.org/api/subscribe/confirm?token=abc_DEF-123');
  });

  it('falls back to the production domain', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(confirmationUrl('t')).toBe('https://distractionindex.org/api/subscribe/confirm?token=t');
  });
});

describe('sendConfirmationEmail', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.org';
    process.env.OUTREACH_FROM_EMAIL = 'weekly@example.org';
  });
  afterEach(() => {
    process.env.RESEND_API_KEY = ORIGINAL.key;
    process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL.site;
    process.env.OUTREACH_FROM_EMAIL = ORIGINAL.from;
  });

  it('sends via Resend to the subscriber with the confirm link in the body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const res = await sendConfirmationEmail('reader@example.com', 'TOKEN123', fetchImpl as unknown as typeof fetch);
    expect(res.sent).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer test-key');
    const payload = JSON.parse((init as { body: string }).body);
    expect(payload.to).toBe('reader@example.com');
    expect(payload.from).toBe('weekly@example.org');
    expect(payload.subject).toMatch(/confirm/i);
    expect(payload.text).toContain('https://example.org/api/subscribe/confirm?token=TOKEN123');
  });

  it('skips (does not throw) when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    const fetchImpl = vi.fn();
    const res = await sendConfirmationEmail('reader@example.com', 'T', fetchImpl as unknown as typeof fetch);
    expect(res.sent).toBe(false);
    expect(res.error).toContain('RESEND_API_KEY');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports a non-OK Resend response as not sent', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 422, text: async () => 'bad from' });
    const res = await sendConfirmationEmail('reader@example.com', 'T', fetchImpl as unknown as typeof fetch);
    expect(res.sent).toBe(false);
    expect(res.error).toContain('422');
  });

  it('reports a thrown fetch as not sent (never throws)', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const res = await sendConfirmationEmail('reader@example.com', 'T', fetchImpl as unknown as typeof fetch);
    expect(res.sent).toBe(false);
    expect(res.error).toContain('network down');
  });
});
