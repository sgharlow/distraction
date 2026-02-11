import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/events — List events with filters
 * Query params: week_id, primary_list, confidence_max, frozen, human_reviewed,
 *               sort_by, sort_dir, limit, offset
 */
export async function GET(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from('events')
    .select('id, week_id, title, event_date, primary_list, is_mixed, a_score, b_score, confidence, human_reviewed, score_frozen, noise_flag, article_count, created_at');

  if (sp.get('week_id')) query = query.eq('week_id', sp.get('week_id')!);
  if (sp.get('primary_list')) query = query.eq('primary_list', sp.get('primary_list')!);
  if (sp.get('confidence_max')) query = query.lt('confidence', Number(sp.get('confidence_max')));
  if (sp.get('frozen') === 'true') query = query.eq('score_frozen', true);
  if (sp.get('frozen') === 'false') query = query.eq('score_frozen', false);
  if (sp.get('human_reviewed') === 'true') query = query.eq('human_reviewed', true);
  if (sp.get('human_reviewed') === 'false') query = query.eq('human_reviewed', false);

  const sortBy = sp.get('sort_by') || 'created_at';
  const sortDir = sp.get('sort_dir') === 'asc';
  query = query.order(sortBy, { ascending: sortDir });

  const limit = Math.min(Number(sp.get('limit') || 50), 200);
  const offset = Number(sp.get('offset') || 0);
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events: data, count });
}

/**
 * PATCH /api/admin/events — Bulk actions
 * Body: { event_ids: string[], action: 'mark_reviewed' | 'rescore' }
 */
export async function PATCH(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { event_ids, action } = body;

  if (!Array.isArray(event_ids) || event_ids.length === 0) {
    return NextResponse.json({ error: 'event_ids required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (action === 'mark_reviewed') {
    const { error } = await supabase
      .from('events')
      .update({ human_reviewed: true })
      .in('id', event_ids);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, updated: event_ids.length });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
