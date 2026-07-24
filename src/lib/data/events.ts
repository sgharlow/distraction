// ═══════════════════════════════════════════════════════════════
// Server-side data fetching — Events
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/server';
import type { Event, Article, ScoreChange, SmokescreenPair } from '@/lib/types';

/**
 * Columns of score_changes readable by the anon role.
 * llm_response and prompt_version are admin-only (column-level grant,
 * see supabase/migrations/20260723000001_security_advisor_fixes.sql) —
 * selecting `*` would fail with a permission error under the anon key.
 */
export type PublicScoreChange = Omit<ScoreChange, 'llm_response' | 'prompt_version'>;

const SCORE_CHANGE_PUBLIC_COLUMNS =
  'id, event_id, week_id, changed_at, changed_by, change_type, ' +
  'old_a_score, new_a_score, old_b_score, new_b_score, old_list, new_list, ' +
  'reason, version_before, version_after';

export interface EventDetail extends Event {
  articles: Article[];
  score_history: PublicScoreChange[];
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
      .select(SCORE_CHANGE_PUBLIC_COLUMNS)
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
    score_history: (historyResult.data || []) as unknown as PublicScoreChange[],
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
