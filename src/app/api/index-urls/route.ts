import { NextRequest, NextResponse } from 'next/server';
import { notifyGoogleIndexingBatch, isGoogleIndexingConfigured } from '@/lib/google-indexing';

export const maxDuration = 30;

/**
 * POST /api/index-urls
 * Manually request Google to index one or more URLs.
 *
 * Body: { urls: string[], action?: "URL_UPDATED" | "URL_DELETED" }
 * Auth: Bearer CRON_SECRET
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isGoogleIndexingConfigured()) {
    return NextResponse.json(
      { error: 'GOOGLE_INDEXING_KEY is not configured' },
      { status: 503 },
    );
  }

  let body: { urls?: string[]; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { urls, action } = body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json(
      { error: 'Request body must include a non-empty "urls" array' },
      { status: 400 },
    );
  }

  // Validate URLs
  const validUrls = urls.filter(u => {
    try {
      new URL(u);
      return true;
    } catch {
      return false;
    }
  });

  if (validUrls.length === 0) {
    return NextResponse.json(
      { error: 'No valid URLs provided' },
      { status: 400 },
    );
  }

  // Cap at 100 URLs per request (Google Indexing API daily quota is 200)
  const cappedUrls = validUrls.slice(0, 100);
  const indexingAction = action === 'URL_DELETED' ? 'URL_DELETED' as const : 'URL_UPDATED' as const;

  const results = await notifyGoogleIndexingBatch(cappedUrls, indexingAction);
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success);

  return NextResponse.json({
    success: true,
    action: indexingAction,
    total: cappedUrls.length,
    notified: succeeded,
    failed: failed.length,
    results,
    ...(cappedUrls.length < validUrls.length
      ? { warning: `Capped to 100 URLs (${validUrls.length} provided)` }
      : {}),
  });
}
