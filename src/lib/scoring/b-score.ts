// ═══════════════════════════════════════════════════════════════
// B-Score Calculator — Distraction / Hype Score (DS)
// Spec Section 6
// ═══════════════════════════════════════════════════════════════

import type { BScoreComponents, BScoreLayer1, BScoreLayer2 } from '@/lib/types';

/**
 * Determine intent weight from intentionality score.
 * Spec 6.2:
 *   >= 8:  Full Layer 2 weight (0.45)
 *   4-7:   Reduced (0.25)
 *   < 4:   Minimal (0.10)
 */
function getIntentWeight(intentScore: number): number {
  if (intentScore >= 8) return 0.45;
  if (intentScore >= 4) return 0.25;
  return 0.10;
}

/**
 * Calculate the B-score from components.
 *
 * Formula (spec 6.4):
 *   hype = avg(outrage_bait, meme_ability, novelty, media_friendliness) / 5
 *   distraction = avg(mismatch, timing, narrative_pivot, pattern_match) / 5
 *   intent_weight = {0.45 if intent>=8, 0.25 if 4-7, 0.10 if <4}
 *   B_score = 100 × (0.55 × hype + intent_weight × distraction)
 */
export function calculateBScore(params: {
  layer1: BScoreLayer1;
  layer2: BScoreLayer2;
  intentionality_total: number;
  intentionality_indicators?: string[];
}): BScoreComponents {
  const { layer1, layer2, intentionality_total, intentionality_indicators = [] } = params;

  // Layer 1: Intrinsic Hype Potential (55%)
  const hype =
    (layer1.outrage_bait + layer1.meme_ability + layer1.novelty + layer1.media_friendliness) /
    4 /
    5;

  // Layer 2: Strategic Distraction Likelihood
  const distraction =
    (layer2.mismatch + layer2.timing + layer2.narrative_pivot + layer2.pattern_match) / 4 / 5;

  // Intent weight
  const intentWeight = getIntentWeight(intentionality_total);

  // Final B-score
  const finalScore = 100 * (0.55 * hype + intentWeight * distraction);

  return {
    layer1,
    layer2,
    intentionality: {
      indicators: intentionality_indicators,
      total: intentionality_total,
    },
    intent_weight: intentWeight,
    final_score: Math.round(finalScore * 10) / 10,
  };
}
