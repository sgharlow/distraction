// ═══════════════════════════════════════════════════════════════
// List Classification Logic
// Spec Section 3
// ═══════════════════════════════════════════════════════════════

import type { PrimaryList, MechanismOfHarm, NoiseReasonCode } from '@/lib/types';

export interface ClassificationResult {
  primary_list: PrimaryList;
  is_mixed: boolean;
  noise_flag: boolean;
  noise_reason_codes: NoiseReasonCode[];
}

/**
 * Classify an event into List A, B, or C based on dual scores.
 *
 * Spec 3.1:
 *   D = A_score - B_score (dominance margin)
 *   List A:  A >= 25 AND D >= +10
 *   List B:  B >= 25 AND D <= -10
 *   Mixed:   Both >= 25 AND |D| < 10 → goes to higher-score list with MIXED badge
 *   Noise:   Passes Noise Gate (Section 7)
 *   Low-sal: A < 25 AND B < 25 AND NOT noise
 */
export function classifyEvent(params: {
  a_score: number;
  b_score: number;
  mechanism_of_harm: MechanismOfHarm | null;
  has_institutional_lever: boolean;
  noise_indicators?: NoiseReasonCode[];
}): ClassificationResult {
  const { a_score, b_score, mechanism_of_harm, has_institutional_lever, noise_indicators = [] } = params;

  const D = a_score - b_score;

  // Check Noise Gate first (spec Section 7)
  const isNoise = checkNoiseGate({
    a_score,
    mechanism_of_harm,
    has_institutional_lever,
    noise_indicators,
  });

  if (isNoise) {
    return {
      primary_list: 'C',
      is_mixed: false,
      noise_flag: true,
      noise_reason_codes: noise_indicators,
    };
  }

  // Clear A-dominant
  if (a_score >= 25 && D >= 10) {
    return { primary_list: 'A', is_mixed: false, noise_flag: false, noise_reason_codes: [] };
  }

  // Clear B-dominant
  if (b_score >= 25 && D <= -10) {
    return { primary_list: 'B', is_mixed: false, noise_flag: false, noise_reason_codes: [] };
  }

  // Mixed: both >= 25 but margin < 10
  if (a_score >= 25 && b_score >= 25 && Math.abs(D) < 10) {
    const list: PrimaryList = a_score >= b_score ? 'A' : 'B';
    return { primary_list: list, is_mixed: true, noise_flag: false, noise_reason_codes: [] };
  }

  // Low salience: both < 25, not noise — put in C but not flagged as noise
  if (a_score < 25 && b_score < 25) {
    return { primary_list: 'C', is_mixed: false, noise_flag: false, noise_reason_codes: [] };
  }

  // Edge case: one score >= 25 but margin not met and the other is < 25
  // Place in the higher-scoring list
  const list: PrimaryList = a_score >= b_score ? 'A' : 'B';
  return { primary_list: list, is_mixed: false, noise_flag: false, noise_reason_codes: [] };
}

/**
 * Noise Gate check.
 * Spec Section 7: Flag as Noise if ALL are true:
 *   - A_score < 25
 *   - mechanism_of_harm is 'norm_erosion_only' or NULL
 *   - No institutional lever pulled
 *   - Mostly status-seeking, grievance, or spectacle (noise_indicators present)
 *   - No credible downstream mechanism
 */
function checkNoiseGate(params: {
  a_score: number;
  mechanism_of_harm: MechanismOfHarm | null;
  has_institutional_lever: boolean;
  noise_indicators: NoiseReasonCode[];
}): boolean {
  const { a_score, mechanism_of_harm, has_institutional_lever, noise_indicators } = params;

  if (a_score >= 25) return false;
  if (mechanism_of_harm && mechanism_of_harm !== 'norm_erosion_only') return false;
  if (has_institutional_lever) return false;
  if (noise_indicators.length === 0) return false;

  return true;
}

/**
 * Get the attention budget classification label.
 * Spec 3.3:
 *   Large positive (+30 or more): "Probable distraction"
 *   Large negative (-30 or more): "Undercovered damage"
 *   Near zero with high scores:   "Mixed signal"
 */
export function getAttentionBudgetLabel(attentionBudget: number): {
  label: string;
  severity: 'distraction' | 'undercovered' | 'mixed';
} {
  if (attentionBudget >= 30) {
    return { label: 'Probable distraction', severity: 'distraction' };
  }
  if (attentionBudget <= -30) {
    return { label: 'Undercovered damage', severity: 'undercovered' };
  }
  return { label: 'Mixed signal', severity: 'mixed' };
}
