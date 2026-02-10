-- ═══════════════════════════════════════════════════════════════
-- The Distraction Index — Database Schema v2.2
-- Migration 001: Initial schema
-- Uses dedicated "distraction" schema to isolate from existing tables.
-- ═══════════════════════════════════════════════════════════════

-- Create the schema
CREATE SCHEMA IF NOT EXISTS distraction;

-- Enable required extensions (these are database-wide, not schema-scoped)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Set search path for this migration
SET search_path TO distraction, public;

-- ═══════════════════════════════════════════════════════════════
-- WEEKLY SNAPSHOTS (the primary organizing unit)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE distraction.weekly_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id TEXT UNIQUE NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'live'
        CHECK (status IN ('live', 'frozen')),
    frozen_at TIMESTAMPTZ,

    total_events INT DEFAULT 0,
    list_a_count INT DEFAULT 0,
    list_b_count INT DEFAULT 0,
    list_c_count INT DEFAULT 0,
    avg_a_score FLOAT,
    avg_b_score FLOAT,
    max_smokescreen_index FLOAT,
    top_smokescreen_pair TEXT,
    week_attention_budget FLOAT,
    total_sources INT DEFAULT 0,
    primary_doc_count INT DEFAULT 0,

    weekly_summary TEXT,
    editors_pick_event_id UUID,

    created_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT valid_week_range CHECK (week_end = week_start + INTERVAL '6 days')
);

-- ═══════════════════════════════════════════════════════════════
-- EVENTS (scoped to a week)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE distraction.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id TEXT NOT NULL REFERENCES distraction.weekly_snapshots(week_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    event_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    related_event_id UUID REFERENCES distraction.events(id),

    actors TEXT[],
    institution TEXT,
    topic_tags TEXT[],
    primary_docs TEXT[],

    mechanism_of_harm TEXT CHECK (mechanism_of_harm IN (
        'policy_change', 'enforcement_action', 'personnel_capture',
        'resource_reallocation', 'election_admin_change', 'judicial_legal_action',
        'norm_erosion_only', 'information_operation'
    )),
    mechanism_secondary TEXT,
    scope TEXT CHECK (scope IN (
        'federal', 'multi_state', 'single_state', 'local', 'international'
    )),
    affected_population TEXT CHECK (affected_population IN (
        'narrow', 'moderate', 'broad'
    )),

    summary TEXT NOT NULL,
    factual_claims JSONB DEFAULT '[]'::jsonb,
    score_rationale TEXT,
    action_item TEXT,

    a_score FLOAT,
    a_components JSONB,
    a_severity_multiplier FLOAT DEFAULT 1.0,

    b_score FLOAT,
    b_layer1_hype JSONB,
    b_layer2_distraction JSONB,
    b_intentionality_score INT,

    attention_budget FLOAT GENERATED ALWAYS AS (
        CASE WHEN b_score IS NOT NULL AND a_score IS NOT NULL
             THEN b_score - a_score
             ELSE NULL
        END
    ) STORED,
    dominance_margin FLOAT GENERATED ALWAYS AS (
        CASE WHEN a_score IS NOT NULL AND b_score IS NOT NULL
             THEN a_score - b_score
             ELSE NULL
        END
    ) STORED,

    primary_list CHAR(1) CHECK (primary_list IN ('A', 'B', 'C')),
    is_mixed BOOLEAN DEFAULT FALSE,
    noise_flag BOOLEAN DEFAULT FALSE,
    noise_reason_codes TEXT[],
    noise_score FLOAT,

    article_count INT DEFAULT 0,
    media_volume FLOAT,
    search_attention FLOAT,

    confidence FLOAT,
    human_reviewed BOOLEAN DEFAULT FALSE,

    score_version INT DEFAULT 1,
    score_frozen BOOLEAN DEFAULT FALSE,
    frozen_at TIMESTAMPTZ,
    frozen_by TEXT,

    correction_notice TEXT,
    correction_at TIMESTAMPTZ,

    fts TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(score_rationale, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(action_item, '')), 'D')
    ) STORED,

    embedding vector(1536)
);

-- Add FK from weekly_snapshots.editors_pick_event_id to events
ALTER TABLE distraction.weekly_snapshots
    ADD CONSTRAINT fk_editors_pick
    FOREIGN KEY (editors_pick_event_id)
    REFERENCES distraction.events(id)
    ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════
-- ARTICLES (linked to events)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE distraction.articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES distraction.events(id) ON DELETE SET NULL,
    week_id TEXT NOT NULL REFERENCES distraction.weekly_snapshots(week_id) ON DELETE CASCADE,

    url TEXT UNIQUE NOT NULL,
    publisher TEXT,
    published_at TIMESTAMPTZ NOT NULL,
    headline TEXT,

    source_type TEXT CHECK (source_type IN (
        'wire', 'national', 'regional', 'opinion', 'blog', 'primary_doc'
    )),
    is_independent BOOLEAN DEFAULT TRUE,
    publisher_reach TEXT CHECK (publisher_reach IN ('major', 'mid', 'niche')),
    stance TEXT,
    extracted_claims JSONB,

    ingested_at TIMESTAMPTZ DEFAULT now(),
    ingestion_source TEXT,

    fts TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(headline, ''))
    ) STORED
);

-- ═══════════════════════════════════════════════════════════════
-- SCORE CHANGE LOG (audit trail)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE distraction.score_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES distraction.events(id) ON DELETE CASCADE,
    week_id TEXT NOT NULL REFERENCES distraction.weekly_snapshots(week_id) ON DELETE CASCADE,
    changed_at TIMESTAMPTZ DEFAULT now(),
    changed_by TEXT NOT NULL,
    change_type TEXT NOT NULL,

    old_a_score FLOAT,
    new_a_score FLOAT,
    old_b_score FLOAT,
    new_b_score FLOAT,
    old_list CHAR(1),
    new_list CHAR(1),
    reason TEXT NOT NULL,

    version_before INT,
    version_after INT,

    prompt_version TEXT,
    llm_response JSONB
);

-- ═══════════════════════════════════════════════════════════════
-- SMOKESCREEN PAIRS (scoped to weeks)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE distraction.smokescreen_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id TEXT NOT NULL REFERENCES distraction.weekly_snapshots(week_id) ON DELETE CASCADE,
    distraction_event_id UUID NOT NULL REFERENCES distraction.events(id) ON DELETE CASCADE,
    damage_event_id UUID NOT NULL REFERENCES distraction.events(id) ON DELETE CASCADE,

    smokescreen_index FLOAT NOT NULL,
    time_delta_hours FLOAT,
    a_coverage_share_before FLOAT,
    a_coverage_share_after FLOAT,
    displacement_delta FLOAT,
    displacement_confidence FLOAT,
    evidence_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT unique_pair_per_week UNIQUE (week_id, distraction_event_id, damage_event_id)
);

-- ═══════════════════════════════════════════════════════════════
-- COMMUNITY FLAGS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE distraction.community_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES distraction.events(id) ON DELETE CASCADE,
    week_id TEXT NOT NULL REFERENCES distraction.weekly_snapshots(week_id) ON DELETE CASCADE,
    suggested_list CHAR(1) CHECK (suggested_list IN ('A', 'B', 'C')),
    reason TEXT NOT NULL,
    source_evidence TEXT,
    upvotes INTEGER DEFAULT 0,
    flagged_by_ip_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- PIPELINE RUNS (operational monitoring)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE distraction.pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type TEXT NOT NULL CHECK (run_type IN ('ingest', 'score', 'freeze', 'backfill')),
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed')),

    articles_fetched INT DEFAULT 0,
    articles_new INT DEFAULT 0,
    events_created INT DEFAULT 0,
    events_scored INT DEFAULT 0,
    errors JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX idx_di_events_week ON distraction.events(week_id);
CREATE INDEX idx_di_events_week_list ON distraction.events(week_id, primary_list);
CREATE INDEX idx_di_events_week_date ON distraction.events(week_id, event_date);
CREATE INDEX idx_di_events_week_a_score ON distraction.events(week_id, a_score DESC NULLS LAST);
CREATE INDEX idx_di_events_week_b_score ON distraction.events(week_id, b_score DESC NULLS LAST);
CREATE INDEX idx_di_articles_week ON distraction.articles(week_id);
CREATE INDEX idx_di_articles_event ON distraction.articles(event_id);
CREATE INDEX idx_di_smokescreen_week ON distraction.smokescreen_pairs(week_id);
CREATE INDEX idx_di_score_changes_event ON distraction.score_changes(event_id);
CREATE INDEX idx_di_score_changes_week ON distraction.score_changes(week_id);
CREATE INDEX idx_di_community_flags_event ON distraction.community_flags(event_id);
CREATE INDEX idx_di_community_flags_week ON distraction.community_flags(week_id);
CREATE INDEX idx_di_weekly_snapshots_status ON distraction.weekly_snapshots(status);
CREATE INDEX idx_di_weekly_snapshots_start ON distraction.weekly_snapshots(week_start);
CREATE INDEX idx_di_pipeline_runs_type ON distraction.pipeline_runs(run_type, started_at DESC);

CREATE INDEX idx_di_events_fts ON distraction.events USING GIN(fts);
CREATE INDEX idx_di_articles_fts ON distraction.articles USING GIN(fts);
CREATE INDEX idx_di_events_topic_tags ON distraction.events USING GIN(topic_tags);
CREATE INDEX idx_di_events_confidence ON distraction.events(confidence) WHERE confidence < 0.7;
CREATE INDEX idx_di_events_unfrozen ON distraction.events(week_id) WHERE score_frozen = FALSE;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION distraction.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
    BEFORE UPDATE ON distraction.events
    FOR EACH ROW
    EXECUTE FUNCTION distraction.update_updated_at();
