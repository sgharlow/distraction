// ═══════════════════════════════════════════════════════════════
// Server-side data fetching — Timeline (cross-week events)
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/server';
import type { Event, PrimaryList } from '@/lib/types';

/**
 * Fetch all events across all weeks, optionally filtered by list.
 * Returns newest first, ordered by event_date then created_at.
 */
export async function getAllEvents(listFilter?: PrimaryList): Promise<Event[]> {
  const supabase = await createClient();

  let query = supabase
    .from('events')
    .select('*')
    .not('primary_list', 'is', null)
    .order('event_date', { ascending: false })
    .order('a_score', { ascending: false, nullsFirst: false });

  if (listFilter) {
    query = query.eq('primary_list', listFilter);
  }

  const { data } = await query;
  return (data || []) as Event[];
}
