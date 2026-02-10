// ═══════════════════════════════════════════════════════════════
// Common types for the ingestion pipeline
// ═══════════════════════════════════════════════════════════════

import type { IngestionSource } from '@/lib/types';

/** Normalized article from any news source */
export interface ArticleInput {
  url: string;
  headline: string;
  summary?: string;
  publisher: string;
  published_at: string;   // ISO 8601
  source: IngestionSource;
}

/** Event identified by Claude from a batch of articles */
export interface IdentifiedEvent {
  title: string;
  event_date: string;
  summary: string;
  mechanism_of_harm: string | null;
  scope: string | null;
  affected_population: string | null;
  actors: string[];
  institution: string | null;
  topic_tags: string[];
  preliminary_list: 'A' | 'B' | 'C';
  article_indices: number[];
  confidence: number;
}

/** Result from a scoring operation */
export interface ScoringResult {
  a_score: {
    drivers: Record<string, number>;
    severity: { durability: number; reversibility: number; precedent: number };
    mechanism_modifier: number;
    scope_modifier: number;
    base_score: number;
    final_score: number;
  };
  b_score: {
    layer1: Record<string, number>;
    layer2: Record<string, number>;
    intentionality: { indicators: string[]; total: number };
    intent_weight: number;
    final_score: number;
  };
  primary_list: 'A' | 'B' | 'C';
  is_mixed: boolean;
  noise_flag: boolean;
  noise_reason_codes: string[];
  confidence: number;
  score_rationale: string;
  action_item: string;
  factual_claims: Array<{ claim: string; source: string; verified: boolean }>;
}
