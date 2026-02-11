import { describe, it, expect } from 'vitest';
import { calculateBScore } from '@/lib/scoring/b-score';
import type { BScoreLayer1, BScoreLayer2 } from '@/lib/types';

function makeLayer1(overrides: Partial<BScoreLayer1> = {}): BScoreLayer1 {
  return {
    outrage_bait: 0,
    meme_ability: 0,
    novelty: 0,
    media_friendliness: 0,
    ...overrides,
  };
}

function makeLayer2(overrides: Partial<BScoreLayer2> = {}): BScoreLayer2 {
  return {
    mismatch: 0,
    timing: 0,
    narrative_pivot: 0,
    pattern_match: 0,
    ...overrides,
  };
}

describe('calculateBScore', () => {
  it('returns 0 for all-zero inputs', () => {
    const result = calculateBScore({
      layer1: makeLayer1(),
      layer2: makeLayer2(),
      intentionality_total: 0,
    });
    expect(result.final_score).toBe(0);
  });

  it('calculates correctly with max Layer 1 and zero Layer 2', () => {
    const result = calculateBScore({
      layer1: makeLayer1({ outrage_bait: 5, meme_ability: 5, novelty: 5, media_friendliness: 5 }),
      layer2: makeLayer2(),
      intentionality_total: 0,
    });
    // hype = (5+5+5+5)/4/5 = 1.0
    // distraction = 0
    // B = 100 * (0.55 * 1.0 + 0.10 * 0) = 55.0
    expect(result.final_score).toBe(55);
  });

  it('calculates correctly with max both layers and high intent', () => {
    const result = calculateBScore({
      layer1: makeLayer1({ outrage_bait: 5, meme_ability: 5, novelty: 5, media_friendliness: 5 }),
      layer2: makeLayer2({ mismatch: 5, timing: 5, narrative_pivot: 5, pattern_match: 5 }),
      intentionality_total: 10,
    });
    // hype = 1.0, distraction = 1.0, intent_weight = 0.45
    // B = 100 * (0.55 * 1.0 + 0.45 * 1.0) = 100
    expect(result.final_score).toBe(100);
  });

  it('uses correct intent weight for high intentionality (>=8)', () => {
    const result = calculateBScore({
      layer1: makeLayer1(),
      layer2: makeLayer2({ mismatch: 5, timing: 5, narrative_pivot: 5, pattern_match: 5 }),
      intentionality_total: 8,
    });
    expect(result.intent_weight).toBe(0.45);
    // B = 100 * (0.55 * 0 + 0.45 * 1.0) = 45
    expect(result.final_score).toBe(45);
  });

  it('uses correct intent weight for mid intentionality (4-7)', () => {
    const result = calculateBScore({
      layer1: makeLayer1(),
      layer2: makeLayer2({ mismatch: 5, timing: 5, narrative_pivot: 5, pattern_match: 5 }),
      intentionality_total: 5,
    });
    expect(result.intent_weight).toBe(0.25);
    // B = 100 * (0.55 * 0 + 0.25 * 1.0) = 25
    expect(result.final_score).toBe(25);
  });

  it('uses correct intent weight for low intentionality (<4)', () => {
    const result = calculateBScore({
      layer1: makeLayer1(),
      layer2: makeLayer2({ mismatch: 5, timing: 5, narrative_pivot: 5, pattern_match: 5 }),
      intentionality_total: 3,
    });
    expect(result.intent_weight).toBe(0.10);
    // B = 100 * (0.55 * 0 + 0.10 * 1.0) = 10
    expect(result.final_score).toBe(10);
  });

  it('clamps driver values to 0-5 range', () => {
    const result = calculateBScore({
      layer1: makeLayer1({ outrage_bait: 10, meme_ability: -3, novelty: 5, media_friendliness: 5 }),
      layer2: makeLayer2(),
      intentionality_total: 0,
    });
    // clamped: (5+0+5+5)/4/5 = 0.75
    // B = 100 * 0.55 * 0.75 = 41.25 -> 41.3
    expect(result.final_score).toBe(41.3);
  });

  it('returns correct component structure', () => {
    const result = calculateBScore({
      layer1: makeLayer1({ outrage_bait: 3 }),
      layer2: makeLayer2({ mismatch: 2 }),
      intentionality_total: 6,
      intentionality_indicators: ['timed within 48hrs', 'emotional trigger'],
    });
    expect(result).toHaveProperty('layer1');
    expect(result).toHaveProperty('layer2');
    expect(result).toHaveProperty('intentionality');
    expect(result).toHaveProperty('intent_weight');
    expect(result).toHaveProperty('final_score');
    expect(result.intentionality.indicators).toHaveLength(2);
    expect(result.intentionality.total).toBe(6);
  });

  it('handles boundary intentionality score of exactly 4', () => {
    const result = calculateBScore({
      layer1: makeLayer1(),
      layer2: makeLayer2(),
      intentionality_total: 4,
    });
    expect(result.intent_weight).toBe(0.25);
  });

  it('handles boundary intentionality score of exactly 7', () => {
    const result = calculateBScore({
      layer1: makeLayer1(),
      layer2: makeLayer2(),
      intentionality_total: 7,
    });
    expect(result.intent_weight).toBe(0.25);
  });

  it('partial Layer 1 scores produce proportional output', () => {
    const result = calculateBScore({
      layer1: makeLayer1({ outrage_bait: 2, meme_ability: 3 }),
      layer2: makeLayer2(),
      intentionality_total: 0,
    });
    // hype = (2+3+0+0)/4/5 = 0.25
    // B = 100 * 0.55 * 0.25 = 13.75 -> 13.8
    expect(result.final_score).toBe(13.8);
  });

  it('defaults intentionality_indicators to empty array', () => {
    const result = calculateBScore({
      layer1: makeLayer1(),
      layer2: makeLayer2(),
      intentionality_total: 0,
    });
    expect(result.intentionality.indicators).toEqual([]);
  });
});
