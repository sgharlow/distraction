// ═══════════════════════════════════════════════════════════════
// Server-side data fetching — Topic pages
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/server';
import type { Event } from '@/lib/types';

/**
 * Fetch all events that have a given topic tag.
 * Returns newest first.
 */
export async function getEventsByTopic(tag: string): Promise<Event[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('events')
    .select('*')
    .contains('topic_tags', [tag])
    .not('primary_list', 'is', null)
    .order('event_date', { ascending: false });

  return (data || []) as Event[];
}

/**
 * Get all unique topic tags across all events, with counts.
 */
export async function getAllTopics(): Promise<Array<{ tag: string; count: number }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('events')
    .select('topic_tags')
    .not('topic_tags', 'is', null)
    .not('primary_list', 'is', null);

  const tagCounts = new Map<string, number>();
  for (const row of data || []) {
    const tags = row.topic_tags as string[] | null;
    if (tags) {
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
  }

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
