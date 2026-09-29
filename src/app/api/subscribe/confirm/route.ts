import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  CONFIRMATION_TTL_HOURS,
  hashConfirmationToken,
  isWellFormedToken,
} from '@/lib/subscribers/confirmation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/subscribe/confirm?token=… — the link in the confirmation email.
 *
 * Sets confirmed = true with the service-role client (the public role has no
 * UPDATE on email_subscribers). Returns a small human-readable HTML page for
 * every outcome. Known limit: some corporate mail scanners pre-fetch links,
 * which would confirm on the reader's behalf; they still had to receive it.
 */
export async function GET(request: Request) {
  const rateLimited = await checkRateLimit(request);
  if (rateLimited) return rateLimited;

  const token = new URL(request.url).searchParams.get('token');
  if (!isWellFormedToken(token)) {
    return page(400, 'Invalid link', 'This confirmation link is invalid. Please copy the full link from the email, or subscribe again.');
  }

  try {
    const supabase = createAdminClient();
    const { data: row, error } = await supabase
      .from('email_subscribers')
      .select('id, confirmed, unsubscribed_at, confirmation_sent_at')
      .eq('confirmation_token_hash', hashConfirmationToken(token))
      .maybeSingle();

    if (error) {
      console.error('[subscribe/confirm] lookup failed:', error.message);
      return page(500, 'Something went wrong', 'We could not confirm your subscription right now. Please try the link again later.');
    }
    if (!row) {
      return page(404, 'Link not valid', 'This confirmation link is not valid. It may have been replaced by a newer email — use the most recent one, or subscribe again.');
    }
    if (row.unsubscribed_at) {
      return page(410, 'Unsubscribed', 'This address has unsubscribed, so it was not re-subscribed.');
    }
    if (row.confirmed) {
      return page(200, 'Already confirmed', 'Your subscription is already confirmed. You will receive the weekly Distraction Index email.');
    }

    const sentAt = row.confirmation_sent_at ? Date.parse(row.confirmation_sent_at) : NaN;
    if (Number.isNaN(sentAt) || Date.now() - sentAt > CONFIRMATION_TTL_HOURS * 3_600_000) {
      return page(410, 'Link expired', 'This confirmation link has expired. Subscribe again on the site to get a fresh link.');
    }

    const { error: updateError } = await supabase
      .from('email_subscribers')
      .update({ confirmed: true, confirmed_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('confirmed', false);

    if (updateError) {
      console.error('[subscribe/confirm] update failed:', updateError.message);
      return page(500, 'Something went wrong', 'We could not confirm your subscription right now. Please try the link again later.');
    }

    return page(200, 'Subscription confirmed', 'Thanks — your subscription is confirmed. You will receive the weekly Distraction Index email.');
  } catch (err) {
    console.error('[subscribe/confirm] threw:', err instanceof Error ? err.message : err);
    return page(500, 'Something went wrong', 'We could not confirm your subscription right now. Please try the link again later.');
  }
}

/** Static copy only — nothing request-derived is echoed into the HTML. */
function page(status: number, title: string, message: string): Response {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${title} — The Distraction Index</title>
<style>body{font-family:Georgia,serif;max-width:520px;margin:15vh auto;padding:0 16px;color:#222;background:#fafafa}h1{font-size:1.4rem}a{color:#222}@media (prefers-color-scheme:dark){body{color:#eee;background:#111}a{color:#eee}}</style>
</head><body><h1>${title}</h1><p>${message}</p><p><a href="/">Back to The Distraction Index</a></p></body></html>`;
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
