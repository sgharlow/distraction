import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentWeekStart, toWeekId } from '@/lib/weeks';
import { addDays } from 'date-fns';

export const maxDuration = 30;

/**
 * /api/freeze
 * Triggered by Vercel Cron at Sunday ~05:00 UTC (Saturday midnight ET).
 * Freezes the week that just ended and creates the new week.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // The current week just started (it's Sunday ~05:00 UTC).
    // We need to freeze the PREVIOUS week.
    const currentWeekStart = getCurrentWeekStart();
    const previousWeekStart = addDays(currentWeekStart, -7);
    const previousWeekId = toWeekId(previousWeekStart);

    // Check if the previous week exists and isn't already frozen
    const { data: prevWeek } = await supabase
      .from('weekly_snapshots')
      .select('week_id, status')
      .eq('week_id', previousWeekId)
      .single();

    if (!prevWeek) {
      return NextResponse.json({
        success: true,
        message: `No data for week ${previousWeekId}, nothing to freeze`,
      });
    }

    if (prevWeek.status === 'frozen') {
      return NextResponse.json({
        success: true,
        message: `Week ${previousWeekId} already frozen`,
      });
    }

    // Freeze the week
    const { data: freezeResult, error: freezeError } = await supabase.rpc(
      'freeze_week',
      { target_week_id: previousWeekId },
    );

    if (freezeError) {
      throw new Error(`Freeze failed: ${freezeError.message}`);
    }

    // Ensure the new current week exists
    await supabase.rpc('ensure_current_week');

    // Log the freeze
    await supabase.from('pipeline_runs').insert({
      run_type: 'freeze',
      status: 'completed',
      completed_at: new Date().toISOString(),
      metadata: { week_frozen: previousWeekId, result: freezeResult },
    });

    return NextResponse.json({
      success: true,
      week_frozen: previousWeekId,
      result: freezeResult,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Freeze job error:', message);

    await supabase.from('pipeline_runs').insert({
      run_type: 'freeze',
      status: 'failed',
      completed_at: new Date().toISOString(),
      errors: [message],
    });

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
