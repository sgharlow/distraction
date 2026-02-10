// ═══════════════════════════════════════════════════════════════
// Smokescreen Index Calculator
// Spec Section 8
// ═══════════════════════════════════════════════════════════════

import type { Event } from '@/lib/types';

export interface SmokescreenCandidate {
  distraction_event: Event;
  damage_event: Event;
  raw_si: number;
  displacement_confidence: number;
  final_si: number;
  severity: 'critical' | 'significant' | 'low';
}

/**
 * Spec 8.2 — Displacement confidence from coverage delta.
 *   delta > 0.20:  high (0.9)
 *   0.10-0.20:     medium (0.6)
 *   0.05-0.10:     low (0.3)
 *   < 0.05:        none (0.0) — DON'T pair
 */
export function getDisplacementConfidence(displacementDelta: number): number {
  if (displacementDelta > 0.20) return 0.9;
  if (displacementDelta >= 0.10) return 0.6;
  if (displacementDelta >= 0.05) return 0.3;
  return 0.0;
}

/**
 * Spec 8.3 — Calculate Smokescreen Index.
 *   raw_SI = B_score × A_score / 100
 *   SI = raw_SI × (0.7 + 0.3 × displacement_confidence)
 */
export function calculateSmokescreenIndex(
  bScore: number,
  aScore: number,
  displacementConfidence: number,
): number {
  const rawSI = (bScore * aScore) / 100;
  return rawSI * (0.7 + 0.3 * displacementConfidence);
}

/**
 * Get severity label for a Smokescreen Index value.
 *   SI > 50:  CRITICAL
 *   SI 25-50: SIGNIFICANT
 *   SI < 25:  LOW
 */
export function getSmokescreenSeverity(si: number): 'critical' | 'significant' | 'low' {
  if (si > 50) return 'critical';
  if (si >= 25) return 'significant';
  return 'low';
}

/**
 * Spec 8.1 — Identify valid smokescreen pairs within a week's events.
 * Pairing Rules:
 *   - B-event intentionality_score >= 4
 *   - A-event a_score >= 40
 *   - Events within same week (enforced by input)
 *   - One B-event can pair with multiple A-events
 *
 * For MVP, displacement_confidence is estimated by the LLM.
 * This function pairs and scores but displacement must be provided.
 */
export function findSmokescreenPairs(
  events: Event[],
  displacementEstimates?: Map<string, number>, // key: `${bEventId}-${aEventId}` → confidence
): SmokescreenCandidate[] {
  const bCandidates = events.filter(
    (e) =>
      e.primary_list === 'B' &&
      e.b_intentionality_score !== null &&
      e.b_intentionality_score >= 4,
  );

  const aCandidates = events.filter(
    (e) => e.primary_list === 'A' && e.a_score !== null && e.a_score >= 40,
  );

  const pairs: SmokescreenCandidate[] = [];

  for (const bEvent of bCandidates) {
    for (const aEvent of aCandidates) {
      const key = `${bEvent.id}-${aEvent.id}`;
      const displacementConf = displacementEstimates?.get(key) ?? 0.5; // default MVP estimate

      if (displacementConf <= 0) continue; // Don't pair if no displacement

      const finalSI = calculateSmokescreenIndex(
        bEvent.b_score!,
        aEvent.a_score!,
        displacementConf,
      );

      pairs.push({
        distraction_event: bEvent,
        damage_event: aEvent,
        raw_si: (bEvent.b_score! * aEvent.a_score!) / 100,
        displacement_confidence: displacementConf,
        final_si: Math.round(finalSI * 10) / 10,
        severity: getSmokescreenSeverity(finalSI),
      });
    }
  }

  return pairs.sort((a, b) => b.final_si - a.final_si);
}
