// ═══════════════════════════════════════════════════════════════
// Newsletter double opt-in.
//
// email_subscribers has had `confirmed BOOLEAN DEFAULT false` since the table
// was created, and the weekly mail (blog/cascade.ts emailSubscribers) only
// sends to confirmed rows — but nothing ever set confirmed = true, so no site
// signup could ever receive it. This module is the missing half:
//
//   subscribe  → server stores sha256(token) + sent_at, emails the raw token
//   confirm    → server hashes the presented token, finds the row, sets
//                confirmed = true (service role; the public role stays
//                INSERT-only on this table)
//
// Only the HASH is stored, so a leaked table read cannot confirm anyone.
// Mail goes through Resend via raw REST — the same provider, env vars and
// from-address as cascade.ts and monitor/alert.ts.
// ═══════════════════════════════════════════════════════════════

import { createHash, randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/** A confirmation link is valid for 7 days after it was sent. */
export const CONFIRMATION_TTL_HOURS = 168;

/** Minimum gap between confirmation emails to one address. */
export const RESEND_COOLDOWN_MINUTES = 15;

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url, no padding

export function generateConfirmationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashConfirmationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isWellFormedToken(token: string | null | undefined): token is string {
  return typeof token === 'string' && TOKEN_RE.test(token);
}

export function confirmationUrl(token: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://distractionindex.org';
  return `${site}/api/subscribe/confirm?token=${encodeURIComponent(token)}`;
}

export interface SendResult {
  sent: boolean;
  error?: string;
}

export async function sendConfirmationEmail(
  email: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, error: 'RESEND_API_KEY not set' };

  const link = confirmationUrl(token);
  const text = [
    'Please confirm your subscription to The Distraction Index weekly email.',
    '',
    `Confirm: ${link}`,
    '',
    `This link expires in ${CONFIRMATION_TTL_HOURS / 24} days. If you did not sign up, ignore this`,
    'email and you will not be subscribed.',
    '',
    '—',
    'The Distraction Index',
    'https://distractionindex.org',
  ].join('\n');

  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: process.env.OUTREACH_FROM_EMAIL ?? 'onboarding@resend.dev',
        to: email,
        subject: 'Confirm your Distraction Index subscription',
        text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { sent: false, error: `Resend responded ${res.status}: ${detail.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: `Resend send threw: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export type ConfirmationOutcome = 'sent' | 'failed';

/**
 * Issue a fresh token for `email`: store its hash (replacing any previous one,
 * which invalidates older links), THEN send it — so a link that arrives always
 * resolves. Never throws.
 */
export async function issueConfirmation(email: string): Promise<ConfirmationOutcome> {
  try {
    const token = generateConfirmationToken();
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('email_subscribers')
      .update({
        confirmation_token_hash: hashConfirmationToken(token),
        confirmation_sent_at: new Date().toISOString(),
      })
      .eq('email', email);

    if (error) {
      console.error('[subscribe] could not store confirmation token:', error.message);
      return 'failed';
    }

    const sent = await sendConfirmationEmail(email, token);
    if (!sent.sent) {
      console.error('[subscribe] confirmation email not sent:', sent.error);
      return 'failed';
    }
    return 'sent';
  } catch (err) {
    console.error('[subscribe] issueConfirmation threw:', err instanceof Error ? err.message : err);
    return 'failed';
  }
}
