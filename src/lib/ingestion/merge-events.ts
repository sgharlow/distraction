// ═══════════════════════════════════════════════════════════════
// Post-clustering event merge
// Deduplicates identified events by title similarity before DB insert
// ═══════════════════════════════════════════════════════════════

import type { IdentifiedEvent } from './types';
import { tokenSimilarity } from './similarity';

/**
 * Merge identified events that have similar titles.
 *
 * - Compares each new event title against other new events using token-overlap similarity.
 * - Merges events above threshold: combines article_indices, keeps higher-confidence metadata.
 * - Skips events whose titles match existing event titles (already in DB).
 *
 * @param events - Events from clustering step
 * @param existingTitles - Titles of events already in DB for this week
 * @param threshold - Similarity threshold for merging (default 0.65)
 * @returns Deduplicated event array
 */
export function mergeIdentifiedEvents(
  events: IdentifiedEvent[],
  existingTitles: string[] = [],
  threshold = 0.65,
): IdentifiedEvent[] {
  if (events.length <= 1) return events;

  // Filter out events whose titles match existing ones
  const filtered = events.filter((evt) =>
    !existingTitles.some((t) => tokenSimilarity(t, evt.title) >= threshold),
  );

  // Merge similar events among the remaining
  const merged: IdentifiedEvent[] = [];
  const consumed = new Set<number>();

  for (let i = 0; i < filtered.length; i++) {
    if (consumed.has(i)) continue;

    let current = { ...filtered[i], article_indices: [...filtered[i].article_indices] };

    for (let j = i + 1; j < filtered.length; j++) {
      if (consumed.has(j)) continue;

      if (tokenSimilarity(current.title, filtered[j].title) >= threshold) {
        // Merge: combine article_indices, keep higher-confidence metadata
        const indices = new Set([...current.article_indices, ...filtered[j].article_indices]);
        current.article_indices = Array.from(indices).sort((a, b) => a - b);

        if (filtered[j].confidence > current.confidence) {
          current = {
            ...filtered[j],
            article_indices: current.article_indices,
          };
        }

        consumed.add(j);
      }
    }

    merged.push(current);
  }

  return merged;
}
