-- ═══════════════════════════════════════════════════════════════
-- Row Level Security Policies — distraction schema
-- Public: read-only access to all tables (no auth required to view)
-- Write: restricted to service_role (API routes) and authenticated admin
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE distraction.weekly_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE distraction.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE distraction.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE distraction.score_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE distraction.smokescreen_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE distraction.community_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE distraction.pipeline_runs ENABLE ROW LEVEL SECURITY;

-- ── Public Read Policies (anyone can view) ──

CREATE POLICY "Public read weekly_snapshots"
    ON distraction.weekly_snapshots FOR SELECT
    USING (true);

CREATE POLICY "Public read events"
    ON distraction.events FOR SELECT
    USING (true);

CREATE POLICY "Public read articles"
    ON distraction.articles FOR SELECT
    USING (true);

CREATE POLICY "Public read score_changes"
    ON distraction.score_changes FOR SELECT
    USING (true);

CREATE POLICY "Public read smokescreen_pairs"
    ON distraction.smokescreen_pairs FOR SELECT
    USING (true);

CREATE POLICY "Public read community_flags"
    ON distraction.community_flags FOR SELECT
    USING (true);

CREATE POLICY "Admin read pipeline_runs"
    ON distraction.pipeline_runs FOR SELECT
    USING (auth.role() = 'authenticated');

-- ── Write Policies (authenticated admin only) ──
-- Note: service_role key bypasses RLS entirely.

CREATE POLICY "Admin write weekly_snapshots"
    ON distraction.weekly_snapshots FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin write events"
    ON distraction.events FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin write articles"
    ON distraction.articles FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin write score_changes"
    ON distraction.score_changes FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin write smokescreen_pairs"
    ON distraction.smokescreen_pairs FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin write pipeline_runs"
    ON distraction.pipeline_runs FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Public insert community_flags"
    ON distraction.community_flags FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admin write community_flags"
    ON distraction.community_flags FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin delete community_flags"
    ON distraction.community_flags FOR DELETE
    USING (auth.role() = 'authenticated');
