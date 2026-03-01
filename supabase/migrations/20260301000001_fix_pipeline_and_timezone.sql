-- ═══════════════════════════════════════════════════════════════
-- Fix 1: Add 'process' to pipeline_runs run_type check constraint
-- The process pipeline has been silently failing because 'process'
-- was not in the allowed values. Only 'ingest', 'score', 'freeze',
-- 'backfill' were allowed.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE distraction.pipeline_runs
  DROP CONSTRAINT IF EXISTS pipeline_runs_run_type_check;

ALTER TABLE distraction.pipeline_runs
  ADD CONSTRAINT pipeline_runs_run_type_check
  CHECK (run_type IN ('ingest', 'process', 'score', 'freeze', 'backfill'));

-- ═══════════════════════════════════════════════════════════════
-- Fix 2: Update ensure_current_week to also create next week
-- when we're within 6 hours of the week boundary (UTC/ET mismatch)
-- This prevents FK violations when Vercel (UTC) calculates next
-- week's ID while the RPC (ET) still sees the current week.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION distraction.ensure_current_week()
RETURNS distraction.weekly_snapshots AS $$
DECLARE
    today_et DATE;
    today_utc DATE;
    week_sunday_et DATE;
    week_sunday_utc DATE;
    week_saturday DATE;
    wid TEXT;
    result distraction.weekly_snapshots;
BEGIN
    -- Calculate week based on ET (primary)
    today_et := (now() AT TIME ZONE 'America/New_York')::date;
    week_sunday_et := today_et - EXTRACT(DOW FROM today_et)::int;
    week_saturday := week_sunday_et + 6;
    wid := to_char(week_sunday_et, 'YYYY-MM-DD');

    INSERT INTO distraction.weekly_snapshots (week_id, week_start, week_end, status)
    VALUES (wid, week_sunday_et, week_saturday, 'live')
    ON CONFLICT (week_id) DO NOTHING;

    -- Also ensure the UTC-based week exists (handles timezone boundary)
    today_utc := (now() AT TIME ZONE 'UTC')::date;
    week_sunday_utc := today_utc - EXTRACT(DOW FROM today_utc)::int;

    IF week_sunday_utc <> week_sunday_et THEN
        INSERT INTO distraction.weekly_snapshots (
            week_id, week_start, week_end, status
        ) VALUES (
            to_char(week_sunday_utc, 'YYYY-MM-DD'),
            week_sunday_utc,
            week_sunday_utc + 6,
            'live'
        )
        ON CONFLICT (week_id) DO NOTHING;
    END IF;

    SELECT * INTO result FROM distraction.weekly_snapshots WHERE week_id = wid;
    RETURN result;
END;
$$ LANGUAGE plpgsql;
