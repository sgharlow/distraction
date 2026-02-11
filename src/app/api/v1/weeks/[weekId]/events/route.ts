// ═══════════════════════════════════════════════════════════════
// Public API — GET /api/v1/weeks/:weekId/events
// Returns all events for a given week, grouped by list.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getWeekData } from '@/lib/data/weeks';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ weekId: string }> }
) {
  const { weekId } = await params;
  const weekData = await getWeekData(weekId);

  if (!weekData) {
    return NextResponse.json(
      { error: 'Week not found', week_id: weekId },
      { status: 404 }
    );
  }

  const allEvents = [
    ...weekData.events.A,
    ...weekData.events.B,
    ...weekData.events.C,
  ];

  return NextResponse.json({
    week_id: weekId,
    status: weekData.snapshot.status,
    total_events: allEvents.length,
    events: {
      A: weekData.events.A.map(eventSummary),
      B: weekData.events.B.map(eventSummary),
      C: weekData.events.C.map(eventSummary),
    },
    smokescreen_pairs: weekData.smokescreenPairs.map((p) => ({
      id: p.id,
      smokescreen_index: p.smokescreen_index,
      displacement_confidence: p.displacement_confidence,
      distraction_event_id: p.distraction_event_id,
      distraction_title: p.distraction_event.title,
      damage_event_id: p.damage_event_id,
      damage_title: p.damage_event.title,
      evidence_notes: p.evidence_notes,
    })),
  });
}

function eventSummary(e: {
  id: string;
  title: string;
  event_date: string;
  primary_list: string | null;
  a_score: number | null;
  b_score: number | null;
  attention_budget: number | null;
  mechanism_of_harm: string | null;
  summary: string;
  article_count: number;
  action_item: string | null;
}) {
  return {
    id: e.id,
    title: e.title,
    event_date: e.event_date,
    primary_list: e.primary_list,
    a_score: e.a_score,
    b_score: e.b_score,
    attention_budget: e.attention_budget,
    mechanism_of_harm: e.mechanism_of_harm,
    summary: e.summary,
    article_count: e.article_count,
    action_item: e.action_item,
  };
}
