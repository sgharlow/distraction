// ═══════════════════════════════════════════════════════════════
// Server-side data fetching — Week snapshots
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/server';
import type { WeeklySnapshot, Event, SmokescreenPair } from '@/lib/types';

export interface WeekData {
  snapshot: WeeklySnapshot;
  events: {
    A: Event[];
    B: Event[];
    C: Event[];
  };
  smokescreenPairs: Array<SmokescreenPair & {
    distraction_event: Pick<Event, 'id' | 'title' | 'a_score' | 'b_score'>;
    damage_event: Pick<Event, 'id' | 'title' | 'a_score' | 'b_score'>;
  }>;
}

/**
 * Fetch full week data: snapshot + events grouped by list + smokescreen pairs.
 */
export async function getWeekData(weekId: string): Promise<WeekData | null> {
  const supabase = await createClient();

  // Fetch snapshot
  const { data: snapshot } = await supabase
    .from('weekly_snapshots')
    .select('*')
    .eq('week_id', weekId)
    .single();

  if (!snapshot) return null;

  // Fetch all events for this week
  const { data: allEvents } = await supabase
    .from('events')
    .select('*')
    .eq('week_id', weekId)
    .not('primary_list', 'is', null)
    .order('a_score', { ascending: false, nullsFirst: false });

  const events = allEvents || [];

  // Group by list, sort appropriately
  const listA = events
    .filter((e) => e.primary_list === 'A')
    .sort((a, b) => (b.a_score || 0) - (a.a_score || 0));

  const listB = events
    .filter((e) => e.primary_list === 'B')
    .sort((a, b) => (b.b_score || 0) - (a.b_score || 0));

  const listC = events
    .filter((e) => e.primary_list === 'C')
    .sort((a, b) => (b.noise_score || 0) - (a.noise_score || 0));

  // Fetch smokescreen pairs
  const { data: pairs } = await supabase
    .from('smokescreen_pairs')
    .select('*')
    .eq('week_id', weekId)
    .order('smokescreen_index', { ascending: false });

  // Attach event info to pairs
  const enrichedPairs = (pairs || []).map((pair) => {
    const distractionEvent = events.find((e) => e.id === pair.distraction_event_id);
    const damageEvent = events.find((e) => e.id === pair.damage_event_id);
    return {
      ...pair,
      distraction_event: distractionEvent
        ? { id: distractionEvent.id, title: distractionEvent.title, a_score: distractionEvent.a_score, b_score: distractionEvent.b_score }
        : { id: pair.distraction_event_id, title: 'Unknown', a_score: null, b_score: null },
      damage_event: damageEvent
        ? { id: damageEvent.id, title: damageEvent.title, a_score: damageEvent.a_score, b_score: damageEvent.b_score }
        : { id: pair.damage_event_id, title: 'Unknown', a_score: null, b_score: null },
    };
  });

  return {
    snapshot: snapshot as WeeklySnapshot,
    events: { A: listA as Event[], B: listB as Event[], C: listC as Event[] },
    smokescreenPairs: enrichedPairs,
  };
}

/**
 * Fetch list of all week snapshots (for week selector/timeline).
 */
export async function getAllWeekSnapshots(): Promise<WeeklySnapshot[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('weekly_snapshots')
    .select('*')
    .order('week_start', { ascending: false });

  return (data || []) as WeeklySnapshot[];
}
