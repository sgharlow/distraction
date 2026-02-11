// ═══════════════════════════════════════════════════════════════
// Public API — GET /api/v1/weeks
// Returns all weekly snapshots, newest first.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getAllWeekSnapshots } from '@/lib/data/weeks';

export async function GET() {
  const weeks = await getAllWeekSnapshots();

  return NextResponse.json({
    count: weeks.length,
    weeks: weeks.map((w) => ({
      week_id: w.week_id,
      week_start: w.week_start,
      week_end: w.week_end,
      status: w.status,
      frozen_at: w.frozen_at,
      total_events: w.total_events,
      list_a_count: w.list_a_count,
      list_b_count: w.list_b_count,
      list_c_count: w.list_c_count,
      avg_a_score: w.avg_a_score,
      avg_b_score: w.avg_b_score,
      max_smokescreen_index: w.max_smokescreen_index,
      week_attention_budget: w.week_attention_budget,
      total_sources: w.total_sources,
    })),
  });
}
