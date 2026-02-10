// ═══════════════════════════════════════════════════════════════
// A-Score Calculator — Constitutional Damage Score (CDS)
// Spec Section 5
// ═══════════════════════════════════════════════════════════════

import {
  type AScoreComponents,
  type ADriverKey,
  type MechanismOfHarm,
  type Scope,
  type AffectedPopulation,
  A_DRIVER_WEIGHTS,
  MECHANISM_MODIFIERS,
} from '@/lib/types';

/** Scope + affected population → modifier */
function getScopeModifier(scope: Scope | null, pop: AffectedPopulation | null): number {
  if (!scope || !pop) return 1.0;

  if (scope === 'federal' && pop === 'broad') return 1.10;
  if (scope === 'multi_state' && pop === 'broad') return 1.05;
  if (scope === 'multi_state' && pop === 'moderate') return 1.00;
  if (scope === 'single_state') return 0.95;
  if (scope === 'local') return 0.90;

  return 1.0;
}

/**
 * Calculate the A-score from components.
 *
 * Formula (spec 5.4):
 *   base_A = 100 × Σ(weight_i × driver_i / 5)
 *   severity_mult = avg(durability, reversibility, precedent)
 *   mechanism_mult = mechanism_modifier × scope_modifier
 *   A_score = min(100, base_A × severity_mult × mechanism_mult)
 */
export function calculateAScore(params: {
  drivers: Record<ADriverKey, number>;
  severity: { durability: number; reversibility: number; precedent: number };
  mechanism: MechanismOfHarm | null;
  scope: Scope | null;
  affected_population: AffectedPopulation | null;
}): AScoreComponents {
  const { drivers, severity, mechanism, scope, affected_population } = params;

  // Base score: weighted sum of drivers
  let baseScore = 0;
  for (const [key, weight] of Object.entries(A_DRIVER_WEIGHTS)) {
    const driverValue = drivers[key as ADriverKey] ?? 0;
    baseScore += weight * (driverValue / 5);
  }
  baseScore *= 100;

  // Severity multiplier: average of three severity dimensions
  const severityMult = (severity.durability + severity.reversibility + severity.precedent) / 3;

  // Mechanism + scope modifiers
  const mechMod = mechanism ? MECHANISM_MODIFIERS[mechanism] : 1.0;
  const scopeMod = getScopeModifier(scope, affected_population);

  // Final score, capped at 100
  const finalScore = Math.min(100, baseScore * severityMult * mechMod * scopeMod);

  return {
    drivers,
    severity,
    mechanism_modifier: mechMod,
    scope_modifier: scopeMod,
    base_score: Math.round(baseScore * 10) / 10,
    final_score: Math.round(finalScore * 10) / 10,
  };
}
