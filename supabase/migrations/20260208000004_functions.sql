-- ═══════════════════════════════════════════════════════════════
-- Database Functions — distraction schema
-- ═══════════════════════════════════════════════════════════════

SET search_path TO distraction, public;

-- ── Ensure Current Week Exists ──
CREATE OR REPLACE FUNCTION distraction.ensure_current_week()
RETURNS distraction.weekly_snapshots AS $$
DECLARE
    today DATE;
    week_sunday DATE;
    week_saturday DATE;
    wid TEXT;
    result distraction.weekly_snapshots;
BEGIN
    today := (now() AT TIME ZONE 'America/New_York')::date;
    week_sunday := today - EXTRACT(DOW FROM today)::int;
    week_saturday := week_sunday + 6;
    wid := to_char(week_sunday, 'YYYY-MM-DD');

    INSERT INTO distraction.weekly_snapshots (week_id, week_start, week_end, status)
    VALUES (wid, week_sunday, week_saturday, 'live')
    ON CONFLICT (week_id) DO NOTHING;

    SELECT * INTO result FROM distraction.weekly_snapshots WHERE week_id = wid;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ── Compute Week Stats ──
CREATE OR REPLACE FUNCTION distraction.compute_week_stats(target_week_id TEXT)
RETURNS void AS $$
BEGIN
    UPDATE distraction.weekly_snapshots SET
        total_events = (
            SELECT COUNT(*) FROM distraction.events WHERE week_id = target_week_id AND primary_list IS NOT NULL
        ),
        list_a_count = (
            SELECT COUNT(*) FROM distraction.events WHERE week_id = target_week_id AND primary_list = 'A'
        ),
        list_b_count = (
            SELECT COUNT(*) FROM distraction.events WHERE week_id = target_week_id AND primary_list = 'B'
        ),
        list_c_count = (
            SELECT COUNT(*) FROM distraction.events WHERE week_id = target_week_id AND primary_list = 'C'
        ),
        avg_a_score = (
            SELECT AVG(a_score) FROM distraction.events WHERE week_id = target_week_id AND a_score IS NOT NULL
        ),
        avg_b_score = (
            SELECT AVG(b_score) FROM distraction.events WHERE week_id = target_week_id AND b_score IS NOT NULL
        ),
        max_smokescreen_index = (
            SELECT MAX(smokescreen_index) FROM distraction.smokescreen_pairs WHERE week_id = target_week_id
        ),
        top_smokescreen_pair = (
            SELECT
                (SELECT title FROM distraction.events WHERE id = sp.distraction_event_id) || ' → ' ||
                (SELECT title FROM distraction.events WHERE id = sp.damage_event_id)
            FROM distraction.smokescreen_pairs sp
            WHERE sp.week_id = target_week_id
            ORDER BY sp.smokescreen_index DESC
            LIMIT 1
        ),
        week_attention_budget = (
            SELECT AVG(attention_budget) FROM distraction.events
            WHERE week_id = target_week_id AND attention_budget IS NOT NULL
        ),
        total_sources = (
            SELECT COUNT(*) FROM distraction.articles WHERE week_id = target_week_id
        ),
        primary_doc_count = (
            SELECT COUNT(*) FROM distraction.articles
            WHERE week_id = target_week_id AND source_type = 'primary_doc'
        )
    WHERE week_id = target_week_id;
END;
$$ LANGUAGE plpgsql;

-- ── Freeze Week ──
CREATE OR REPLACE FUNCTION distraction.freeze_week(target_week_id TEXT)
RETURNS jsonb AS $$
DECLARE
    week_rec distraction.weekly_snapshots;
    frozen_count INT;
BEGIN
    SELECT * INTO week_rec FROM distraction.weekly_snapshots WHERE week_id = target_week_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Week not found: ' || target_week_id);
    END IF;

    IF week_rec.status = 'frozen' THEN
        RETURN jsonb_build_object('error', 'Week already frozen: ' || target_week_id);
    END IF;

    UPDATE distraction.events SET
        score_frozen = TRUE,
        frozen_at = now(),
        frozen_by = 'system:weekly_freeze'
    WHERE week_id = target_week_id
      AND score_frozen = FALSE;

    GET DIAGNOSTICS frozen_count = ROW_COUNT;

    INSERT INTO distraction.score_changes (event_id, week_id, changed_by, change_type, new_a_score, new_b_score, new_list, reason, version_after)
    SELECT
        id, week_id, 'system:weekly_freeze', 'freeze',
        a_score, b_score, primary_list,
        'Weekly freeze: ' || target_week_id,
        score_version
    FROM distraction.events
    WHERE week_id = target_week_id
      AND frozen_by = 'system:weekly_freeze'
      AND frozen_at >= now() - INTERVAL '1 minute';

    PERFORM distraction.compute_week_stats(target_week_id);

    UPDATE distraction.weekly_snapshots SET
        status = 'frozen',
        frozen_at = now()
    WHERE week_id = target_week_id;

    RETURN jsonb_build_object(
        'success', true,
        'week_id', target_week_id,
        'events_frozen', frozen_count
    );
END;
$$ LANGUAGE plpgsql;

-- ── Auto-Freeze Events ──
CREATE OR REPLACE FUNCTION distraction.auto_freeze_events()
RETURNS INT AS $$
DECLARE
    frozen_count INT;
BEGIN
    UPDATE distraction.events SET
        score_frozen = TRUE,
        frozen_at = now(),
        frozen_by = 'system:48h_auto'
    WHERE score_frozen = FALSE
      AND created_at < now() - INTERVAL '48 hours'
      AND week_id IN (SELECT week_id FROM distraction.weekly_snapshots WHERE status = 'live');

    GET DIAGNOSTICS frozen_count = ROW_COUNT;

    INSERT INTO distraction.score_changes (event_id, week_id, changed_by, change_type, new_a_score, new_b_score, new_list, reason, version_after)
    SELECT
        id, week_id, 'system:48h_auto', 'freeze',
        a_score, b_score, primary_list,
        '48-hour auto-freeze',
        score_version
    FROM distraction.events
    WHERE frozen_by = 'system:48h_auto'
      AND frozen_at >= now() - INTERVAL '1 minute';

    RETURN frozen_count;
END;
$$ LANGUAGE plpgsql;

-- ── Create Week Snapshot (for backfill) ──
CREATE OR REPLACE FUNCTION distraction.create_week_snapshot(
    p_week_start DATE,
    p_status TEXT DEFAULT 'frozen'
)
RETURNS distraction.weekly_snapshots AS $$
DECLARE
    p_week_end DATE;
    wid TEXT;
    result distraction.weekly_snapshots;
BEGIN
    p_week_end := p_week_start + 6;
    wid := to_char(p_week_start, 'YYYY-MM-DD');

    INSERT INTO distraction.weekly_snapshots (week_id, week_start, week_end, status, frozen_at)
    VALUES (
        wid, p_week_start, p_week_end, p_status,
        CASE WHEN p_status = 'frozen' THEN now() ELSE NULL END
    )
    ON CONFLICT (week_id) DO UPDATE SET
        status = EXCLUDED.status,
        frozen_at = EXCLUDED.frozen_at;

    SELECT * INTO result FROM distraction.weekly_snapshots WHERE week_id = wid;
    RETURN result;
END;
$$ LANGUAGE plpgsql;
