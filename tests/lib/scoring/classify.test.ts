import { describe, it, expect } from 'vitest';
import { classifyEvent, getAttentionBudgetLabel } from '@/lib/scoring/classify';

describe('classifyEvent', () => {
  it('classifies as List A when A >= 25 and dominance margin >= 10', () => {
    const result = classifyEvent({
      a_score: 60,
      b_score: 30,
      mechanism_of_harm: 'policy_change',
      has_institutional_lever: true,
    });
    expect(result.primary_list).toBe('A');
    expect(result.is_mixed).toBe(false);
    expect(result.noise_flag).toBe(false);
  });

  it('classifies as List B when B >= 25 and dominance margin <= -10', () => {
    const result = classifyEvent({
      a_score: 20,
      b_score: 50,
      mechanism_of_harm: null,
      has_institutional_lever: false,
    });
    expect(result.primary_list).toBe('B');
    expect(result.is_mixed).toBe(false);
  });

  it('classifies as Mixed when both >= 25 and |D| < 10, A higher', () => {
    const result = classifyEvent({
      a_score: 40,
      b_score: 38,
      mechanism_of_harm: 'policy_change',
      has_institutional_lever: true,
    });
    expect(result.primary_list).toBe('A');
    expect(result.is_mixed).toBe(true);
  });

  it('classifies as Mixed when both >= 25 and |D| < 10, B higher', () => {
    const result = classifyEvent({
      a_score: 30,
      b_score: 35,
      mechanism_of_harm: 'policy_change',
      has_institutional_lever: true,
    });
    expect(result.primary_list).toBe('B');
    expect(result.is_mixed).toBe(true);
  });

  it('classifies as Noise (List C) when noise gate passes', () => {
    const result = classifyEvent({
      a_score: 10,
      b_score: 10,
      mechanism_of_harm: 'norm_erosion_only',
      has_institutional_lever: false,
      noise_indicators: ['spectacle', 'vanity'],
    });
    expect(result.primary_list).toBe('C');
    expect(result.noise_flag).toBe(true);
    expect(result.noise_reason_codes).toEqual(['spectacle', 'vanity']);
  });

  it('classifies as low-salience List C when both scores < 25 and not noise', () => {
    const result = classifyEvent({
      a_score: 15,
      b_score: 10,
      mechanism_of_harm: 'policy_change',
      has_institutional_lever: true,
    });
    expect(result.primary_list).toBe('C');
    expect(result.noise_flag).toBe(false);
    expect(result.is_mixed).toBe(false);
  });

  it('noise gate requires A < 25', () => {
    const result = classifyEvent({
      a_score: 30,
      b_score: 10,
      mechanism_of_harm: 'norm_erosion_only',
      has_institutional_lever: false,
      noise_indicators: ['spectacle'],
    });
    // A >= 25, so noise gate should NOT trigger
    expect(result.noise_flag).toBe(false);
  });

  it('noise gate requires mechanism to be norm_erosion_only or null', () => {
    const result = classifyEvent({
      a_score: 10,
      b_score: 10,
      mechanism_of_harm: 'enforcement_action',
      has_institutional_lever: false,
      noise_indicators: ['spectacle'],
    });
    expect(result.noise_flag).toBe(false);
  });

  it('noise gate requires no institutional lever', () => {
    const result = classifyEvent({
      a_score: 10,
      b_score: 10,
      mechanism_of_harm: 'norm_erosion_only',
      has_institutional_lever: true,
      noise_indicators: ['spectacle'],
    });
    expect(result.noise_flag).toBe(false);
  });

  it('noise gate requires noise indicators to be present', () => {
    const result = classifyEvent({
      a_score: 10,
      b_score: 10,
      mechanism_of_harm: 'norm_erosion_only',
      has_institutional_lever: false,
      noise_indicators: [],
    });
    expect(result.noise_flag).toBe(false);
  });

  it('noise gate with null mechanism still passes', () => {
    const result = classifyEvent({
      a_score: 10,
      b_score: 10,
      mechanism_of_harm: null,
      has_institutional_lever: false,
      noise_indicators: ['feud'],
    });
    expect(result.primary_list).toBe('C');
    expect(result.noise_flag).toBe(true);
  });

  it('edge case: A >= 25 and B < 25 with margin not met', () => {
    const result = classifyEvent({
      a_score: 30,
      b_score: 22,
      mechanism_of_harm: 'policy_change',
      has_institutional_lever: true,
    });
    // D = 8, which is < 10, but B < 25 so not mixed
    // Should fall to edge case: A >= B so list A
    expect(result.primary_list).toBe('A');
    expect(result.is_mixed).toBe(false);
  });

  it('edge case: B >= 25 and A < 25 with margin not met', () => {
    const result = classifyEvent({
      a_score: 20,
      b_score: 28,
      mechanism_of_harm: null,
      has_institutional_lever: false,
    });
    // D = -8, which > -10, but A < 25 so not mixed
    // Should fall to edge case: B > A so list B
    expect(result.primary_list).toBe('B');
    expect(result.is_mixed).toBe(false);
  });

  it('exact boundary: D = 10 is List A', () => {
    const result = classifyEvent({
      a_score: 35,
      b_score: 25,
      mechanism_of_harm: 'policy_change',
      has_institutional_lever: true,
    });
    expect(result.primary_list).toBe('A');
    expect(result.is_mixed).toBe(false);
  });

  it('exact boundary: D = -10 is List B', () => {
    const result = classifyEvent({
      a_score: 25,
      b_score: 35,
      mechanism_of_harm: null,
      has_institutional_lever: false,
    });
    expect(result.primary_list).toBe('B');
    expect(result.is_mixed).toBe(false);
  });
});

describe('getAttentionBudgetLabel', () => {
  it('returns "Probable distraction" for budget >= 30', () => {
    const result = getAttentionBudgetLabel(30);
    expect(result.label).toBe('Probable distraction');
    expect(result.severity).toBe('distraction');
  });

  it('returns "Probable distraction" for budget = 50', () => {
    const result = getAttentionBudgetLabel(50);
    expect(result.severity).toBe('distraction');
  });

  it('returns "Undercovered damage" for budget <= -30', () => {
    const result = getAttentionBudgetLabel(-30);
    expect(result.label).toBe('Undercovered damage');
    expect(result.severity).toBe('undercovered');
  });

  it('returns "Mixed signal" for budget between -30 and 30', () => {
    const result = getAttentionBudgetLabel(0);
    expect(result.label).toBe('Mixed signal');
    expect(result.severity).toBe('mixed');
  });

  it('returns "Mixed signal" for budget = 29', () => {
    const result = getAttentionBudgetLabel(29);
    expect(result.severity).toBe('mixed');
  });

  it('returns "Mixed signal" for budget = -29', () => {
    const result = getAttentionBudgetLabel(-29);
    expect(result.severity).toBe('mixed');
  });
});
