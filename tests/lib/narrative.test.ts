import { describe, it, expect } from 'vitest';
import { generateLiveBriefing } from '@/lib/narrative';
import type { WeeklySnapshot, Event } from '@/lib/types';

function makeSnapshot(overrides: Partial<WeeklySnapshot> = {}): WeeklySnapshot {
  return {
    id: 'snap-1',
    week_id: '2026-02-09',
    week_start: '2026-02-09',
    week_end: '2026-02-15',
    status: 'live',
    frozen_at: null,
    total_events: 5,
    list_a_count: 2,
    list_b_count: 2,
    list_c_count: 1,
    avg_a_score: 45.0,
    avg_b_score: 38.0,
    max_smokescreen_index: null,
    top_smokescreen_pair: null,
    week_attention_budget: 7.0,
    total_sources: 42,
    primary_doc_count: 3,
    weekly_summary: null,
    editors_pick_event_id: null,
    created_at: '2026-02-09T00:00:00Z',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'evt-1',
    week_id: '2026-02-09',
    title: 'Test Event',
    event_date: '2026-02-10',
    summary: 'A test event summary',
    score_rationale: null,
    primary_list: 'A',
    is_mixed: false,
    noise_flag: false,
    noise_reason_codes: null,
    noise_score: null,
    a_score: 50.0,
    b_score: 20.0,
    a_components: null,
    b_layer1_hype: null,
    b_layer2_distraction: null,
    b_intentionality_score: null,
    attention_budget: -30,
    dominance_margin: 30,
    mechanism_of_harm: null,
    scope: null,
    affected_population: null,
    actors: null,
    institution: null,
    topic_tags: null,
    primary_docs: null,
    action_item: null,
    factual_claims: null,
    article_count: 5,
    confidence: 0.85,
    score_version: 1,
    score_frozen: false,
    frozen_at: null,
    frozen_by: null,
    correction_notice: null,
    correction_at: null,
    created_at: '2026-02-10T00:00:00Z',
    updated_at: '2026-02-10T00:00:00Z',
    ...overrides,
  } as Event;
}

describe('generateLiveBriefing', () => {
  it('returns null when no events exist', () => {
    const snapshot = makeSnapshot({ total_events: 0 });
    const result = generateLiveBriefing({ snapshot, topDamage: [], topDistraction: [] });
    expect(result).toBeNull();
  });

  it('generates editorial briefing with both A and B events', () => {
    const snapshot = makeSnapshot();
    const topA = makeEvent({ title: 'Big Damage', a_score: 72.5 });
    const topB = makeEvent({ title: 'Shiny Distraction', b_score: 65.0, primary_list: 'B' });

    const result = generateLiveBriefing({
      snapshot,
      topDamage: [topA],
      topDistraction: [topB],
    });

    expect(result).toContain('"Big Damage"');
    expect(result).toContain('"Shiny Distraction"');
    expect(result).toContain('critical constitutional damage');
    expect(result).toContain('5 events tracked across 42 sources');
  });

  it('generates briefing with A-only events using critical language for high scores', () => {
    const snapshot = makeSnapshot();
    const topA = makeEvent({ title: 'Only Damage', a_score: 55.0 });

    const result = generateLiveBriefing({
      snapshot,
      topDamage: [topA],
      topDistraction: [],
    });

    expect(result).toContain('"Only Damage"');
    expect(result).toContain('critical');
    expect(result).toContain('55.0');
  });

  it('generates briefing with A-only events using notable language for moderate scores', () => {
    const snapshot = makeSnapshot();
    const topA = makeEvent({ title: 'Moderate Damage', a_score: 25.0 });

    const result = generateLiveBriefing({
      snapshot,
      topDamage: [topA],
      topDistraction: [],
    });

    expect(result).toContain('"Moderate Damage"');
    expect(result).toContain('25.0');
  });

  it('generates briefing with B-only events', () => {
    const snapshot = makeSnapshot();
    const topB = makeEvent({ title: 'Only Distraction', b_score: 40.0, primary_list: 'B' });

    const result = generateLiveBriefing({
      snapshot,
      topDamage: [],
      topDistraction: [topB],
    });

    expect(result).toContain('"Only Distraction"');
    expect(result).toContain('B: 40.0');
  });

  it('includes Critical smokescreen with editorial language when SI >= 50', () => {
    const snapshot = makeSnapshot({ max_smokescreen_index: 65.0 });
    const topA = makeEvent({ title: 'Damage', a_score: 50.0 });

    const result = generateLiveBriefing({
      snapshot,
      topDamage: [topA],
      topDistraction: [],
    });

    expect(result).toContain('Critical smokescreen activity detected');
    expect(result).toContain('SI: 65');
    expect(result).toContain('displacing coverage');
  });

  it('includes Significant smokescreen when SI >= 25 and < 50', () => {
    const snapshot = makeSnapshot({ max_smokescreen_index: 35.0 });
    const topA = makeEvent({ title: 'Damage', a_score: 50.0 });

    const result = generateLiveBriefing({
      snapshot,
      topDamage: [topA],
      topDistraction: [],
    });

    expect(result).toContain('Significant smokescreen activity detected');
    expect(result).toContain('SI: 35');
  });

  it('excludes smokescreen when SI < 25', () => {
    const snapshot = makeSnapshot({ max_smokescreen_index: 15.0 });
    const topA = makeEvent({ title: 'Damage', a_score: 50.0 });

    const result = generateLiveBriefing({
      snapshot,
      topDamage: [topA],
      topDistraction: [],
    });

    expect(result).not.toContain('smokescreen');
  });

  it('notes imbalance when few List A but many List B events', () => {
    const snapshot = makeSnapshot({ list_a_count: 3, list_b_count: 25, total_events: 30 });
    const topA = makeEvent({ title: 'Damage', a_score: 50.0 });
    const topB = makeEvent({ title: 'Distraction', b_score: 60.0, primary_list: 'B' });

    const result = generateLiveBriefing({
      snapshot,
      topDamage: [topA],
      topDistraction: [topB],
    });

    expect(result).toContain('distraction pattern');
    expect(result).toContain('only 3 made the damage list');
    expect(result).toContain('25 competed for attention');
  });
});
