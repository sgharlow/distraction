// ═══════════════════════════════════════════════════════════════
// Server-side data fetching — Events
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/server';
import type { Event, Article, ScoreChange, SmokescreenPair } from '@/lib/types';

export interface EventDetail extends Event {
  articles: Article[];
  score_history: ScoreChange[];
  smokescreen_for: Array<SmokescreenPair & { damage_event: Pick<Event, 'id' | 'title' | 'a_score' | 'b_score'> }>;
  smokescreened_by: Array<SmokescreenPair & { distraction_event: Pick<Event, 'id' | 'title' | 'a_score' | 'b_score'> }>;
}

/**
 * Fetch full event detail with articles, score history, and smokescreen connections.
 */
export async function getEventDetail(eventId: string): Promise<EventDetail | null> {
  const supabase = await createClient();

  // Fetch event
  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (!event) return null;

  // Fetch articles, score history, and smokescreen pairs in parallel
  const [articlesResult, historyResult, smokescreenForResult, smokescreenedByResult, weekEventsResult] = await Promise.all([
    supabase
      .from('articles')
      .select('*')
      .eq('event_id', eventId)
      .order('published_at', { ascending: false }),
    supabase
      .from('score_changes')
      .select('*')
      .eq('event_id', eventId)
      .order('changed_at', { ascending: true }),
    supabase
      .from('smokescreen_pairs')
      .select('*')
      .eq('distraction_event_id', eventId),
    supabase
      .from('smokescreen_pairs')
      .select('*')
      .eq('damage_event_id', eventId),
    supabase
      .from('events')
      .select('id, title, a_score, b_score')
      .eq('week_id', event.week_id),
  ]);

  const weekEvents = weekEventsResult.data || [];

  // Enrich smokescreen pairs with event titles
  const smokescreenFor = (smokescreenForResult.data || []).map((pair) => {
    const damageEvent = weekEvents.find((e) => e.id === pair.damage_event_id);
    return {
      ...pair,
      damage_event: damageEvent || { id: pair.damage_event_id, title: 'Unknown', a_score: null, b_score: null },
    };
  });

  const smokescreenedBy = (smokescreenedByResult.data || []).map((pair) => {
    const distractionEvent = weekEvents.find((e) => e.id === pair.distraction_event_id);
    return {
      ...pair,
      distraction_event: distractionEvent || { id: pair.distraction_event_id, title: 'Unknown', a_score: null, b_score: null },
    };
  });

  return {
    ...(event as Event),
    articles: (articlesResult.data || []) as Article[],
    score_history: (historyResult.data || []) as ScoreChange[],
    smokescreen_for: smokescreenFor,
    smokescreened_by: smokescreenedBy,
  };
}

/**
 * Search events across all weeks.
 */
export async function searchEvents(query: string, limit = 20): Promise<Event[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('events')
    .select('*')
    .textSearch('fts', query, { type: 'websearch' })
    .limit(limit);

  return (data || []) as Event[];
}
