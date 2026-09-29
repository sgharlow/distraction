import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { issueConfirmation, RESEND_COOLDOWN_MINUTES } from '@/lib/subscribers/confirmation';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid email address' },
        { status: 400 },
      );
    }

    // Public (anon) insert of { email } only — the public role stays INSERT-only.
    const supabase = await createClient();
    const { error } = await supabase
      .from('email_subscribers')
      .insert({ email });

    if (error) {
      // Unique constraint violation — already on the list
      if (error.code === '23505') {
        return handleExisting(email);
      }
      return NextResponse.json(
        { status: 'error', message: 'Subscription failed' },
        { status: 500 },
      );
    }

    // Double opt-in: the weekly mail only goes to confirmed rows.
    const confirmation = await issueConfirmation(email);
    return NextResponse.json({ status: 'subscribed', confirmation });
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Invalid request' },
      { status: 400 },
    );
  }
}

/**
 * The address is already in the table. If it never confirmed (and has not
 * unsubscribed), send a fresh link — this is also how someone whose link
 * expired gets a new one — subject to a short cooldown so the form cannot be
 * used to flood a mailbox. Confirmed or unsubscribed rows get no email.
 */
async function handleExisting(email: string) {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('email_subscribers')
    .select('id, confirmed, unsubscribed_at, confirmation_sent_at')
    .eq('email', email)
    .maybeSingle();

  if (error || !row || row.confirmed || row.unsubscribed_at) {
    return NextResponse.json({ status: 'already_subscribed' });
  }

  const lastSent = row.confirmation_sent_at ? Date.parse(row.confirmation_sent_at) : NaN;
  if (!Number.isNaN(lastSent) && Date.now() - lastSent < RESEND_COOLDOWN_MINUTES * 60_000) {
    return NextResponse.json({ status: 'subscribed', confirmation: 'recently_sent' });
  }

  const confirmation = await issueConfirmation(email);
  return NextResponse.json({ status: 'subscribed', confirmation });
}
