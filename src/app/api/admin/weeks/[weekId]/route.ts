import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/weeks/[weekId] — Week detail with event counts
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ weekId: string }> },
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { weekId } = await params;
  const supabase = createAdminClient();

  const [{ data: week, error }, { data: events }] = await Promise.all([
    supabase.from('weekly_snapshots').select('*').eq('week_id', weekId).single(),
    supabase
      .from('events')
      .select('id, title, primary_list, a_score, b_score, is_mixed')
      .eq('week_id', weekId)
      .order('a_score', { ascending: false }),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  return NextResponse.json({ week, events: events || [] });
}

/**
 * PATCH /api/admin/weeks/[weekId] — Update week fields
 * Body: { weekly_summary?, editors_pick_event_id? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ weekId: string }> },
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { weekId } = await params;
  const body = await request.json();
  const supabase = createAdminClient();

  const allowedFields = ['weekly_summary', 'editors_pick_event_id'];
  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('weekly_snapshots')
    .update(updates)
    .eq('week_id', weekId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ week: data });
}

/**
 * POST /api/admin/weeks/[weekId] — Freeze or unfreeze a week
 * Body: { action: 'freeze' | 'unfreeze' | 'recompute' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ weekId: string }> },
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { weekId } = await params;
  const body = await request.json();
  const supabase = createAdminClient();

  if (body.action === 'freeze') {
    // Freeze week and all its events
    await supabase
      .from('weekly_snapshots')
      .update({ status: 'frozen', frozen_at: new Date().toISOString() })
      .eq('week_id', weekId);

    await supabase
      .from('events')
      .update({ score_frozen: true, frozen_at: new Date().toISOString() })
      .eq('week_id', weekId);

    return NextResponse.json({ success: true, action: 'freeze' });
  }

  if (body.action === 'unfreeze') {
    await supabase
      .from('weekly_snapshots')
      .update({ status: 'live', frozen_at: null })
      .eq('week_id', weekId);

    await supabase
      .from('events')
      .update({ score_frozen: false, frozen_at: null })
      .eq('week_id', weekId);

    return NextResponse.json({ success: true, action: 'unfreeze' });
  }

  if (body.action === 'recompute') {
    await supabase.rpc('compute_week_stats', { target_week_id: weekId });
    return NextResponse.json({ success: true, action: 'recompute' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
