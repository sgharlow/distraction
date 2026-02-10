// ═══════════════════════════════════════════════════════════════
// The Distraction Index — TypeScript types matching DB schema
// ═══════════════════════════════════════════════════════════════

// ── Enums ──

export type WeekStatus = 'live' | 'frozen';

export type MechanismOfHarm =
  | 'policy_change'
  | 'enforcement_action'
  | 'personnel_capture'
  | 'resource_reallocation'
  | 'election_admin_change'
  | 'judicial_legal_action'
  | 'norm_erosion_only'
  | 'information_operation';

export type Scope = 'federal' | 'multi_state' | 'single_state' | 'local' | 'international';

export type AffectedPopulation = 'narrow' | 'moderate' | 'broad';

export type PrimaryList = 'A' | 'B' | 'C';

export type SourceType = 'wire' | 'national' | 'regional' | 'opinion' | 'blog' | 'primary_doc';

export type PublisherReach = 'major' | 'mid' | 'niche';

export type NoiseReasonCode = 'vanity' | 'credit-grab' | 'stale-reshare' | 'spectacle' | 'feud';

export type ChangeType = 'initial' | 'rescore' | 'override' | 'freeze' | 'correction';

export type PipelineRunType = 'ingest' | 'score' | 'freeze' | 'backfill';

export type PipelineRunStatus = 'running' | 'completed' | 'failed';

export type IngestionSource = 'gdelt' | 'gnews' | 'google_news' | 'manual';

// ── A-Score Components ──

export const A_DRIVER_KEYS = [
  'election',
  'rule_of_law',
  'separation',
  'civil_rights',
  'capture',
  'corruption',
  'violence',
] as const;

export type ADriverKey = typeof A_DRIVER_KEYS[number];

export const A_DRIVER_WEIGHTS: Record<ADriverKey, number> = {
  election: 0.22,
  rule_of_law: 0.18,
  separation: 0.16,
  civil_rights: 0.14,
  capture: 0.14,
  corruption: 0.10,
  violence: 0.06,
};

export const A_DRIVER_LABELS: Record<ADriverKey, string> = {
  election: 'Election Integrity & Transfer of Power',
  rule_of_law: 'Rule of Law / Due Process',
  separation: 'Separation of Powers',
  civil_rights: 'Civil Rights / Equal Protection',
  capture: 'Institutional Capture',
  corruption: 'Corruption / Self-Dealing',
  violence: 'Violence / Intimidation Enabling',
};

export interface AScoreComponents {
  drivers: Record<ADriverKey, number>;     // each 0-5
  severity: {
    durability: number;                     // 0.8-1.3
    reversibility: number;                  // 0.8-1.3
    precedent: number;                      // 0.8-1.3
  };
  mechanism_modifier: number;               // 0.90-1.15
  scope_modifier: number;                   // 0.90-1.10
  base_score: number;                       // before multipliers
  final_score: number;                      // capped at 100
}

// ── B-Score Components ──

export const B_LAYER1_KEYS = ['outrage_bait', 'meme_ability', 'novelty', 'media_friendliness'] as const;
export type BLayer1Key = typeof B_LAYER1_KEYS[number];

export const B_LAYER1_LABELS: Record<BLayer1Key, string> = {
  outrage_bait: 'Outrage-bait',
  meme_ability: 'Meme-ability',
  novelty: 'Novelty Spike',
  media_friendliness: 'Media Friendliness',
};

export const B_LAYER2_KEYS = ['mismatch', 'timing', 'narrative_pivot', 'pattern_match'] as const;
export type BLayer2Key = typeof B_LAYER2_KEYS[number];

export const B_LAYER2_LABELS: Record<BLayer2Key, string> = {
  mismatch: 'Media-Volume Mismatch',
  timing: 'Timing Overlap',
  narrative_pivot: 'Narrative Pivot',
  pattern_match: 'Repeat Pattern Match',
};

export interface BScoreLayer1 {
  outrage_bait: number;                     // 0-5
  meme_ability: number;
  novelty: number;
  media_friendliness: number;
}

export interface BScoreLayer2 {
  mismatch: number;                         // 0-5
  timing: number;
  narrative_pivot: number;
  pattern_match: number;
}

export interface BScoreComponents {
  layer1: BScoreLayer1;
  layer2: BScoreLayer2;
  intentionality: {
    indicators: string[];
    total: number;                          // 0-15
  };
  intent_weight: number;                    // 0.10, 0.25, or 0.45
  final_score: number;
}

// ── Mechanism Modifiers ──

export const MECHANISM_MODIFIERS: Record<MechanismOfHarm, number> = {
  election_admin_change: 1.15,
  judicial_legal_action: 1.10,
  enforcement_action: 1.10,
  personnel_capture: 1.05,
  policy_change: 1.05,
  resource_reallocation: 1.00,
  information_operation: 0.95,
  norm_erosion_only: 0.90,
};

export const MECHANISM_LABELS: Record<MechanismOfHarm, string> = {
  election_admin_change: 'Election Admin Change',
  judicial_legal_action: 'Judicial/Legal Action',
  enforcement_action: 'Enforcement Action',
  personnel_capture: 'Personnel Capture',
  policy_change: 'Policy Change',
  resource_reallocation: 'Resource Reallocation',
  information_operation: 'Information Operation',
  norm_erosion_only: 'Norm Erosion Only',
};

// ── Table Row Types ──

export interface WeeklySnapshot {
  id: string;
  week_id: string;
  week_start: string;                       // DATE as ISO string
  week_end: string;
  status: WeekStatus;
  frozen_at: string | null;

  total_events: number;
  list_a_count: number;
  list_b_count: number;
  list_c_count: number;
  avg_a_score: number | null;
  avg_b_score: number | null;
  max_smokescreen_index: number | null;
  top_smokescreen_pair: string | null;
  week_attention_budget: number | null;
  total_sources: number;
  primary_doc_count: number;

  weekly_summary: string | null;
  editors_pick_event_id: string | null;

  created_at: string;
}

export interface Event {
  id: string;
  week_id: string;
  title: string;
  event_date: string;
  created_at: string;
  updated_at: string;

  related_event_id: string | null;

  actors: string[] | null;
  institution: string | null;
  topic_tags: string[] | null;
  primary_docs: string[] | null;

  mechanism_of_harm: MechanismOfHarm | null;
  mechanism_secondary: string | null;
  scope: Scope | null;
  affected_population: AffectedPopulation | null;

  summary: string;
  factual_claims: Array<{ claim: string; source: string; verified: boolean }>;
  score_rationale: string | null;
  action_item: string | null;

  a_score: number | null;
  a_components: AScoreComponents | null;
  a_severity_multiplier: number;

  b_score: number | null;
  b_layer1_hype: BScoreLayer1 | null;
  b_layer2_distraction: BScoreLayer2 | null;
  b_intentionality_score: number | null;

  // Computed
  attention_budget: number | null;
  dominance_margin: number | null;

  primary_list: PrimaryList | null;
  is_mixed: boolean;
  noise_flag: boolean;
  noise_reason_codes: NoiseReasonCode[] | null;
  noise_score: number | null;

  article_count: number;
  media_volume: number | null;
  search_attention: number | null;

  confidence: number | null;
  human_reviewed: boolean;

  score_version: number;
  score_frozen: boolean;
  frozen_at: string | null;
  frozen_by: string | null;

  correction_notice: string | null;
  correction_at: string | null;
}

export interface Article {
  id: string;
  event_id: string | null;
  week_id: string;

  url: string;
  publisher: string | null;
  published_at: string;
  headline: string | null;

  source_type: SourceType | null;
  is_independent: boolean;
  publisher_reach: PublisherReach | null;
  stance: string | null;
  extracted_claims: unknown;

  ingested_at: string;
  ingestion_source: IngestionSource | null;
}

export interface ScoreChange {
  id: string;
  event_id: string;
  week_id: string;
  changed_at: string;
  changed_by: string;
  change_type: ChangeType;

  old_a_score: number | null;
  new_a_score: number | null;
  old_b_score: number | null;
  new_b_score: number | null;
  old_list: PrimaryList | null;
  new_list: PrimaryList | null;
  reason: string;

  version_before: number | null;
  version_after: number | null;

  prompt_version: string | null;
  llm_response: unknown;
}

export interface SmokescreenPair {
  id: string;
  week_id: string;
  distraction_event_id: string;
  damage_event_id: string;

  smokescreen_index: number;
  time_delta_hours: number | null;
  a_coverage_share_before: number | null;
  a_coverage_share_after: number | null;
  displacement_delta: number | null;
  displacement_confidence: number | null;
  evidence_notes: string | null;

  created_at: string;
}

export interface CommunityFlag {
  id: string;
  event_id: string;
  week_id: string;
  suggested_list: PrimaryList | null;
  reason: string;
  source_evidence: string | null;
  upvotes: number;
  flagged_by_ip_hash: string | null;
  created_at: string;
}

export interface PipelineRun {
  id: string;
  run_type: PipelineRunType;
  started_at: string;
  completed_at: string | null;
  status: PipelineRunStatus;

  articles_fetched: number;
  articles_new: number;
  events_created: number;
  events_scored: number;
  errors: unknown[];
  metadata: Record<string, unknown>;
}

// ── Joined / View Types ──

export interface EventWithArticles extends Event {
  articles: Article[];
}

export interface EventWithSmokescreens extends Event {
  smokescreen_for: Array<SmokescreenPair & { damage_event: Event }>;
  smokescreened_by: Array<SmokescreenPair & { distraction_event: Event }>;
}

export interface WeekWithEvents extends WeeklySnapshot {
  events: {
    A: Event[];
    B: Event[];
    C: Event[];
  };
}
