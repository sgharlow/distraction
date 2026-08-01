// ═══════════════════════════════════════════════════════════════
// Scoring Service — Orchestrates Claude API calls for dual scoring
// ═══════════════════════════════════════════════════════════════

import { callSonnet, extractJSON } from '@/lib/claude';
import { DUAL_SCORING_SYSTEM, DUAL_SCORING_USER, PROMPT_VERSION } from './prompts';
import { calculateAScore } from './a-score';
import { calculateBScore } from './b-score';
import { classifyEvent } from './classify';
import { findSmokescreenPairs, type SmokescreenCandidate } from './smokescreen';
import type { ScoringResult } from '@/lib/ingestion/types';
import type { Event, ADriverKey, MechanismOfHarm, Scope, AffectedPopulation, NoiseReasonCode, BScoreLayer1, BScoreLayer2 } from '@/lib/types';

/**
 * Score a single event using Claude Sonnet.
 * Returns the full scoring result with breakdown.
 */
export async function scoreEvent(params: {
  title: string;
  summary: string;
  mechanism: string | null;
  scope: string | null;
  affected_population: string | null;
  articleHeadlines: string[];
  weekEventTitles?: string[];
}): Promise<{
  result: ScoringResult;
  tokens: { input: number; output: number };
  prompt_version: string;
  raw_response: string;
}> {
  const articlesText = params.articleHeadlines
    .map((h, i) => `${i + 1}. ${h}`)
    .join('\n');

  const weekContext = params.weekEventTitles
    ? params.weekEventTitles.map((t) => `- ${t}`).join('\n')
    : undefined;

  const userPrompt = DUAL_SCORING_USER({
    title: params.title,
    summary: params.summary,
    mechanism: params.mechanism,
    scope: params.scope,
    affected_population: params.affected_population,
    articles: articlesText,
    week_context: weekContext,
  });

  // Sonnet 5's adaptive thinking shares the ONE output budget with the answer
  // JSON. Measured on the real scoring prompt: a complex high-damage event's
  // thinking block alone consumed up to ~8058 output tokens, so the "safe-looking"
  // 8192 left only ~130 tokens for the ~600-900-token answer — one heavy event
  // would truncate the JSON mid-string and JSON.parse would throw opaquely,
  // silently dropping the highest-A events (this is exactly what corrupted the
  // 07-19 backfill week). 16000 leaves ample room after thinking.
  const SCORE_MAX_TOKENS = 16000;
  const response = await callSonnet(DUAL_SCORING_SYSTEM, userPrompt, SCORE_MAX_TOKENS);

  // Fail LOUD on truncation instead of letting extractJSON throw an opaque
  // "Unterminated string". A max_tokens stop on a single event score should not
  // happen at 16000 — if it does, surface it as a distinct, diagnosable error so
  // it is never mistaken for a transient failure and quietly skipped.
  if (response.stop_reason === 'max_tokens') {
    throw new Error(
      `scoreEvent truncated at max_tokens=${SCORE_MAX_TOKENS} (output=${response.output_tokens}) — event "${params.title}" not scored`,
    );
  }

  const result = extractJSON<ScoringResult>(response.text);

  // Validate and clamp scores
  result.a_score.final_score = Math.min(100, Math.max(0, result.a_score.final_score));
  result.b_score.final_score = Math.min(100, Math.max(0, result.b_score.final_score));

  // Verify the scores using our local formula as a sanity check
  const localA = calculateAScore({
    drivers: result.a_score.drivers as Record<ADriverKey, number>,
    severity: result.a_score.severity,
    mechanism: params.mechanism as MechanismOfHarm | null,
    scope: params.scope as Scope | null,
    affected_population: params.affected_population as AffectedPopulation | null,
  });

  const localB = calculateBScore({
    layer1: result.b_score.layer1 as unknown as BScoreLayer1,
    layer2: result.b_score.layer2 as unknown as BScoreLayer2,
    intentionality_total: result.b_score.intentionality.total,
    intentionality_indicators: result.b_score.intentionality.indicators,
  });

  // Use Claude's component assessments but recalculate with our formulas for consistency
  result.a_score.final_score = localA.final_score;
  result.a_score.base_score = localA.base_score;
  result.a_score.mechanism_modifier = localA.mechanism_modifier;
  result.a_score.scope_modifier = localA.scope_modifier;
  result.b_score.final_score = localB.final_score;
  result.b_score.intent_weight = localB.intent_weight;

  // Reclassify with our local logic for consistency
  const classification = classifyEvent({
    a_score: result.a_score.final_score,
    b_score: result.b_score.final_score,
    mechanism_of_harm: params.mechanism as MechanismOfHarm | null,
    has_institutional_lever: !!params.mechanism && params.mechanism !== 'norm_erosion_only',
    noise_indicators: result.noise_reason_codes as NoiseReasonCode[],
  });

  result.primary_list = classification.primary_list;
  result.is_mixed = classification.is_mixed;
  result.noise_flag = classification.noise_flag;

  return {
    result,
    tokens: { input: response.input_tokens, output: response.output_tokens },
    prompt_version: PROMPT_VERSION,
    raw_response: response.text,
  };
}

/**
 * Run smokescreen pairing for a set of events (typically all events in a week).
 */
export function pairSmokescreens(
  events: Event[],
  displacementEstimates?: Map<string, number>,
): SmokescreenCandidate[] {
  return findSmokescreenPairs(events, displacementEstimates);
}
