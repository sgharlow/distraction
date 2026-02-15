import { describe, it, expect } from 'vitest';
import { mergeIdentifiedEvents } from '@/lib/ingestion/merge-events';
import type { IdentifiedEvent } from '@/lib/ingestion/types';

function makeEvent(overrides: Partial<IdentifiedEvent> = {}): IdentifiedEvent {
  return {
    title: 'Test Event',
    event_date: '2026-02-10',
    summary: 'Test summary',
    mechanism_of_harm: null,
    scope: null,
    affected_population: null,
    actors: [],
    institution: null,
    topic_tags: [],
    preliminary_list: 'A',
    article_indices: [0],
    confidence: 0.8,
    ...overrides,
  };
}

describe('mergeIdentifiedEvents', () => {
  it('returns unchanged when no duplicates', () => {
    const events = [
      makeEvent({ title: 'Immigration Executive Order', article_indices: [0, 1] }),
      makeEvent({ title: 'Supreme Court Ruling on Abortion', article_indices: [2, 3] }),
    ];
    const result = mergeIdentifiedEvents(events, []);
    expect(result).toHaveLength(2);
  });

  it('merges events with similar titles', () => {
    const events = [
      makeEvent({ title: 'Trump Signs Executive Order on Immigration', article_indices: [0, 1] }),
      makeEvent({ title: 'Trump Signs Executive Order on Immigration Policy', article_indices: [2, 3] }),
    ];
    const result = mergeIdentifiedEvents(events, []);
    expect(result).toHaveLength(1);
    expect(result[0].article_indices).toEqual([0, 1, 2, 3]);
  });

  it('keeps dissimilar events separate', () => {
    const events = [
      makeEvent({ title: 'DOJ Sues Google Over Antitrust', article_indices: [0] }),
      makeEvent({ title: 'Trump Signs Executive Order on Immigration', article_indices: [1] }),
    ];
    const result = mergeIdentifiedEvents(events, []);
    expect(result).toHaveLength(2);
  });

  it('combines and deduplicates article_indices', () => {
    const events = [
      makeEvent({ title: 'Executive Order on Immigration Reform', article_indices: [0, 1, 3] }),
      makeEvent({ title: 'Executive Order on Immigration Policy Reform', article_indices: [1, 2, 4] }),
    ];
    const result = mergeIdentifiedEvents(events, []);
    expect(result).toHaveLength(1);
    expect(result[0].article_indices).toEqual([0, 1, 2, 3, 4]);
  });

  it('keeps higher-confidence metadata when merging', () => {
    const events = [
      makeEvent({ title: 'Trump Executive Order on Immigration', article_indices: [0], confidence: 0.6, summary: 'Low confidence' }),
      makeEvent({ title: 'Trump Executive Order on Immigration Policy', article_indices: [1], confidence: 0.9, summary: 'High confidence' }),
    ];
    const result = mergeIdentifiedEvents(events, []);
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(0.9);
    expect(result[0].summary).toBe('High confidence');
  });

  it('skips events matching existing titles', () => {
    const events = [
      makeEvent({ title: 'DOJ Sues Google Over Antitrust', article_indices: [0] }),
      makeEvent({ title: 'New Supreme Court Ruling', article_indices: [1] }),
    ];
    const existingTitles = ['DOJ Sues Google Over Antitrust Violations'];
    const result = mergeIdentifiedEvents(events, existingTitles);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('New Supreme Court Ruling');
  });

  it('handles empty input', () => {
    expect(mergeIdentifiedEvents([], [])).toEqual([]);
  });

  it('handles single event input', () => {
    const events = [makeEvent({ title: 'Single Event' })];
    const result = mergeIdentifiedEvents(events, []);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Single Event');
  });
});
