import { describe, it, expect } from 'vitest';
import {
  getDisplacementConfidence,
  calculateSmokescreenIndex,
  getSmokescreenSeverity,
  findSmokescreenPairs,
} from '@/lib/scoring/smokescreen';
import type { Event } from '@/lib/types';

describe('getDisplacementConfidence', () => {
  it('returns 0.9 for delta > 0.20', () => {
    expect(getDisplacementConfidence(0.25)).toBe(0.9);
    expect(getDisplacementConfidence(0.50)).toBe(0.9);
  });

  it('returns 0.6 for delta 0.10-0.20', () => {
    expect(getDisplacementConfidence(0.10)).toBe(0.6);
    expect(getDisplacementConfidence(0.15)).toBe(0.6);
    expect(getDisplacementConfidence(0.20)).toBe(0.6);
  });

  it('returns 0.3 for delta 0.05-0.10 (exclusive)', () => {
    expect(getDisplacementConfidence(0.05)).toBe(0.3);
    expect(getDisplacementConfidence(0.08)).toBe(0.3);
  });

  it('returns 0.0 for delta < 0.05', () => {
    expect(getDisplacementConfidence(0.04)).toBe(0.0);
    expect(getDisplacementConfidence(0.0)).toBe(0.0);
    expect(getDisplacementConfidence(-0.1)).toBe(0.0);
  });
});

describe('calculateSmokescreenIndex', () => {
  it('calculates raw SI = B * A / 100', () => {
    // raw = 80 * 60 / 100 = 48
    // SI = 48 * (0.7 + 0.3 * 0.9) = 48 * 0.97 = 46.56
    const si = calculateSmokescreenIndex(80, 60, 0.9);
    expect(si).toBeCloseTo(46.56, 1);
  });

  it('returns 0 when B or A is 0', () => {
    expect(calculateSmokescreenIndex(0, 60, 0.9)).toBe(0);
    expect(calculateSmokescreenIndex(80, 0, 0.9)).toBe(0);
  });

  it('scales with displacement confidence', () => {
    const lowConf = calculateSmokescreenIndex(80, 60, 0.0);
    const highConf = calculateSmokescreenIndex(80, 60, 0.9);
    // lowConf = 48 * 0.7 = 33.6
    // highConf = 48 * 0.97 = 46.56
    expect(lowConf).toBeCloseTo(33.6, 1);
    expect(highConf).toBeGreaterThan(lowConf);
  });

  it('uses formula: raw_SI * (0.7 + 0.3 * confidence)', () => {
    // raw = 50 * 50 / 100 = 25
    // With conf=0.5: 25 * (0.7 + 0.15) = 25 * 0.85 = 21.25
    const si = calculateSmokescreenIndex(50, 50, 0.5);
    expect(si).toBeCloseTo(21.25, 2);
  });
});

describe('getSmokescreenSeverity', () => {
  it('returns "critical" for SI > 50', () => {
    expect(getSmokescreenSeverity(51)).toBe('critical');
    expect(getSmokescreenSeverity(100)).toBe('critical');
  });

  it('returns "significant" for SI 25-50', () => {
    expect(getSmokescreenSeverity(25)).toBe('significant');
    expect(getSmokescreenSeverity(50)).toBe('significant');
    expect(getSmokescreenSeverity(37)).toBe('significant');
  });

  it('returns "low" for SI < 25', () => {
    expect(getSmokescreenSeverity(24)).toBe('low');
    expect(getSmokescreenSeverity(0)).toBe('low');
    expect(getSmokescreenSeverity(10)).toBe('low');
  });
});

// Helper to make a minimal mock Event for testing findSmokescreenPairs
function makeEvent(overrides: Partial<Event>): Event {
  return {
    id: 'test-id',
    week_id: '2025-01-05',
    title: 'Test Event',
    event_date: '2025-01-06',
    created_at: '2025-01-06T00:00:00Z',
    updated_at: '2025-01-06T00:00:00Z',
    related_event_id: null,
    actors: null,
    institution: null,
    topic_tags: null,
    primary_docs: null,
    mechanism_of_harm: null,
    mechanism_secondary: null,
    scope: null,
    affected_population: null,
    summary: 'Test summary',
    factual_claims: [],
    score_rationale: null,
    action_item: null,
    a_score: null,
    a_components: null,
    a_severity_multiplier: 1,
    b_score: null,
    b_layer1_hype: null,
    b_layer2_distraction: null,
    b_intentionality_score: null,
    attention_budget: null,
    dominance_margin: null,
    primary_list: null,
    is_mixed: false,
    noise_flag: false,
    noise_reason_codes: null,
    noise_score: null,
    article_count: 0,
    media_volume: null,
    search_attention: null,
    confidence: null,
    human_reviewed: false,
    score_version: 1,
    score_frozen: false,
    frozen_at: null,
    frozen_by: null,
    correction_notice: null,
    correction_at: null,
    ...overrides,
  };
}

describe('findSmokescreenPairs', () => {
  it('pairs B events (intent >= 4) with A events (score >= 40)', () => {
    const events: Event[] = [
      makeEvent({
        id: 'b1',
        primary_list: 'B',
        b_score: 70,
        b_intentionality_score: 8,
      }),
      makeEvent({
        id: 'a1',
        primary_list: 'A',
        a_score: 50,
      }),
    ];

    const pairs = findSmokescreenPairs(events);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].distraction_event.id).toBe('b1');
    expect(pairs[0].damage_event.id).toBe('a1');
  });

  it('does not pair B events with intent < 4', () => {
    const events: Event[] = [
      makeEvent({
        id: 'b1',
        primary_list: 'B',
        b_score: 70,
        b_intentionality_score: 3,
      }),
      makeEvent({
        id: 'a1',
        primary_list: 'A',
        a_score: 50,
      }),
    ];

    const pairs = findSmokescreenPairs(events);
    expect(pairs).toHaveLength(0);
  });

  it('does not pair A events with score < 40', () => {
    const events: Event[] = [
      makeEvent({
        id: 'b1',
        primary_list: 'B',
        b_score: 70,
        b_intentionality_score: 8,
      }),
      makeEvent({
        id: 'a1',
        primary_list: 'A',
        a_score: 35,
      }),
    ];

    const pairs = findSmokescreenPairs(events);
    expect(pairs).toHaveLength(0);
  });

  it('creates multiple pairs when one B matches multiple A events', () => {
    const events: Event[] = [
      makeEvent({ id: 'b1', primary_list: 'B', b_score: 70, b_intentionality_score: 10 }),
      makeEvent({ id: 'a1', primary_list: 'A', a_score: 50 }),
      makeEvent({ id: 'a2', primary_list: 'A', a_score: 45 }),
    ];

    const pairs = findSmokescreenPairs(events);
    expect(pairs).toHaveLength(2);
  });

  it('sorts pairs by final_si descending', () => {
    const events: Event[] = [
      makeEvent({ id: 'b1', primary_list: 'B', b_score: 70, b_intentionality_score: 10 }),
      makeEvent({ id: 'a1', primary_list: 'A', a_score: 50 }),
      makeEvent({ id: 'a2', primary_list: 'A', a_score: 90 }),
    ];

    const pairs = findSmokescreenPairs(events);
    expect(pairs[0].damage_event.id).toBe('a2');
    expect(pairs[0].final_si).toBeGreaterThan(pairs[1].final_si);
  });

  it('uses displacement estimates when provided', () => {
    const events: Event[] = [
      makeEvent({ id: 'b1', primary_list: 'B', b_score: 70, b_intentionality_score: 10 }),
      makeEvent({ id: 'a1', primary_list: 'A', a_score: 50 }),
    ];

    const estimates = new Map([['b1-a1', 0.9]]);
    const pairs = findSmokescreenPairs(events, estimates);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].displacement_confidence).toBe(0.9);
  });

  it('skips pairs with displacement confidence of 0', () => {
    const events: Event[] = [
      makeEvent({ id: 'b1', primary_list: 'B', b_score: 70, b_intentionality_score: 10 }),
      makeEvent({ id: 'a1', primary_list: 'A', a_score: 50 }),
    ];

    const estimates = new Map([['b1-a1', 0.0]]);
    const pairs = findSmokescreenPairs(events, estimates);
    expect(pairs).toHaveLength(0);
  });

  it('returns empty array for no events', () => {
    expect(findSmokescreenPairs([])).toEqual([]);
  });
});
