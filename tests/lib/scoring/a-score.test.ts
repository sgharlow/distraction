import { describe, it, expect } from 'vitest';
import { calculateAScore } from '@/lib/scoring/a-score';
import type { ADriverKey, MechanismOfHarm, Scope, AffectedPopulation } from '@/lib/types';

function makeDrivers(overrides: Partial<Record<ADriverKey, number>> = {}): Record<ADriverKey, number> {
  return {
    election: 0,
    rule_of_law: 0,
    separation: 0,
    civil_rights: 0,
    capture: 0,
    corruption: 0,
    violence: 0,
    ...overrides,
  };
}

describe('calculateAScore', () => {
  it('returns 0 for all-zero drivers', () => {
    const result = calculateAScore({
      drivers: makeDrivers(),
      severity: { durability: 1, reversibility: 1, precedent: 1 },
      mechanism: null,
      scope: null,
      affected_population: null,
    });
    expect(result.final_score).toBe(0);
    expect(result.base_score).toBe(0);
  });

  it('returns the correct base score for maximum drivers (all 5)', () => {
    const result = calculateAScore({
      drivers: makeDrivers({
        election: 5, rule_of_law: 5, separation: 5,
        civil_rights: 5, capture: 5, corruption: 5, violence: 5,
      }),
      severity: { durability: 1, reversibility: 1, precedent: 1 },
      mechanism: null,
      scope: null,
      affected_population: null,
    });
    // Sum of weights = 0.22+0.18+0.16+0.14+0.14+0.10+0.06 = 1.0
    // base = 100 * 1.0 * (5/5) = 100
    expect(result.base_score).toBe(100);
    expect(result.final_score).toBe(100);
  });

  it('applies driver weights correctly', () => {
    // Only election driver at 5 (weight 0.22)
    const result = calculateAScore({
      drivers: makeDrivers({ election: 5 }),
      severity: { durability: 1, reversibility: 1, precedent: 1 },
      mechanism: null,
      scope: null,
      affected_population: null,
    });
    // base = 100 * 0.22 * (5/5) = 22
    expect(result.base_score).toBe(22);
    expect(result.final_score).toBe(22);
  });

  it('applies severity multiplier correctly', () => {
    const result = calculateAScore({
      drivers: makeDrivers({ election: 5 }),
      severity: { durability: 1.3, reversibility: 1.3, precedent: 1.3 },
      mechanism: null,
      scope: null,
      affected_population: null,
    });
    // base = 22, severity_mult = 1.3
    // final = 22 * 1.3 = 28.6
    expect(result.final_score).toBe(28.6);
  });

  it('applies mechanism modifier for election_admin_change (1.15)', () => {
    const result = calculateAScore({
      drivers: makeDrivers({ election: 5 }),
      severity: { durability: 1, reversibility: 1, precedent: 1 },
      mechanism: 'election_admin_change',
      scope: null,
      affected_population: null,
    });
    // base = 22 * 1.15 = 25.3
    expect(result.final_score).toBe(25.3);
  });

  it('applies mechanism modifier for norm_erosion_only (0.90)', () => {
    const result = calculateAScore({
      drivers: makeDrivers({ election: 5 }),
      severity: { durability: 1, reversibility: 1, precedent: 1 },
      mechanism: 'norm_erosion_only',
      scope: null,
      affected_population: null,
    });
    // base = 22 * 0.9 = 19.8
    expect(result.final_score).toBe(19.8);
  });

  it('applies scope modifier for federal + broad (1.10)', () => {
    const result = calculateAScore({
      drivers: makeDrivers({ election: 5 }),
      severity: { durability: 1, reversibility: 1, precedent: 1 },
      mechanism: null,
      scope: 'federal',
      affected_population: 'broad',
    });
    // base = 22 * 1.10 = 24.2
    expect(result.final_score).toBe(24.2);
  });

  it('applies scope modifier for local (0.90)', () => {
    const result = calculateAScore({
      drivers: makeDrivers({ election: 5 }),
      severity: { durability: 1, reversibility: 1, precedent: 1 },
      mechanism: null,
      scope: 'local',
      affected_population: 'narrow',
    });
    // base = 22 * 0.9 = 19.8
    expect(result.final_score).toBe(19.8);
  });

  it('applies scope modifier for single_state (0.95)', () => {
    const result = calculateAScore({
      drivers: makeDrivers({ election: 5 }),
      severity: { durability: 1, reversibility: 1, precedent: 1 },
      mechanism: null,
      scope: 'single_state',
      affected_population: 'broad',
    });
    // 22 * 0.95 = 20.9
    expect(result.final_score).toBe(20.9);
  });

  it('caps the final score at 100', () => {
    const result = calculateAScore({
      drivers: makeDrivers({
        election: 5, rule_of_law: 5, separation: 5,
        civil_rights: 5, capture: 5, corruption: 5, violence: 5,
      }),
      severity: { durability: 1.3, reversibility: 1.3, precedent: 1.3 },
      mechanism: 'election_admin_change',
      scope: 'federal',
      affected_population: 'broad',
    });
    // Would be 100 * 1.3 * 1.15 * 1.10 = 164.45, capped at 100
    expect(result.final_score).toBe(100);
  });

  it('combines mechanism and scope modifiers', () => {
    const result = calculateAScore({
      drivers: makeDrivers({ election: 5 }),
      severity: { durability: 1, reversibility: 1, precedent: 1 },
      mechanism: 'enforcement_action',
      scope: 'federal',
      affected_population: 'broad',
    });
    // 22 * 1.10 * 1.10 = 26.62 -> 26.6
    expect(result.final_score).toBe(26.6);
  });

  it('handles partial driver scores', () => {
    const result = calculateAScore({
      drivers: makeDrivers({ election: 3, rule_of_law: 2 }),
      severity: { durability: 1, reversibility: 1, precedent: 1 },
      mechanism: null,
      scope: null,
      affected_population: null,
    });
    // base = 100 * (0.22*3/5 + 0.18*2/5) = 100 * (0.132 + 0.072) = 20.4
    expect(result.base_score).toBe(20.4);
  });

  it('returns correct component structure', () => {
    const result = calculateAScore({
      drivers: makeDrivers({ election: 3 }),
      severity: { durability: 1.1, reversibility: 0.9, precedent: 1.0 },
      mechanism: 'policy_change',
      scope: 'multi_state',
      affected_population: 'broad',
    });
    expect(result).toHaveProperty('drivers');
    expect(result).toHaveProperty('severity');
    expect(result).toHaveProperty('mechanism_modifier');
    expect(result).toHaveProperty('scope_modifier');
    expect(result).toHaveProperty('base_score');
    expect(result).toHaveProperty('final_score');
    expect(result.mechanism_modifier).toBe(1.05);
    expect(result.scope_modifier).toBe(1.05);
  });

  it('handles low severity multipliers correctly', () => {
    const result = calculateAScore({
      drivers: makeDrivers({ election: 5 }),
      severity: { durability: 0.8, reversibility: 0.8, precedent: 0.8 },
      mechanism: null,
      scope: null,
      affected_population: null,
    });
    // base = 22, severity_mult = 0.8
    // final = 22 * 0.8 = 17.6
    expect(result.final_score).toBe(17.6);
  });
});
