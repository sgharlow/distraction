-- ═══════════════════════════════════════════════════════════════
-- Security Advisor Fixes — 2026-07-23
--
-- Fix 1: Pin per-function search_path on all six functions in the
--   distraction schema (Supabase linter: function_search_path_mutable).
--   The session-level `SET search_path` at the top of the original
--   migration scripts does NOT persist into the function definitions,
--   so each function ran with the caller's mutable search_path.
--   All function bodies already schema-qualify their table references
--   (distraction.*) and otherwise use only pg_catalog built-ins
--   (now(), to_char(), jsonb_build_object(), EXTRACT), so pinning
--   `distraction, public` is behavior-preserving.
--
-- Fix 2: Column-level lockdown of distraction.score_changes.
--   The "Public read score_changes" RLS policy (USING true) combined
--   with GRANT SELECT to anon exposed the raw Claude scoring payload
--   (llm_response JSONB) and prompt_version to anonymous callers of
--   the PostgREST API. The public UI never renders those columns
--   (verified: src/app/event/[eventId]/page.tsx renders only
--   version_after, changed_at, new_a_score, new_b_score, changed_by,
--   reason; the admin UI reads via /api/admin/* which uses the
--   service_role client and is unaffected by grants/RLS).
--   Approach: revoke table-wide SELECT from anon + authenticated,
--   then grant SELECT on the non-sensitive columns only. The
--   "Public read score_changes" row policy is kept — RLS still
--   allows all rows; the column grant now controls which columns
--   are readable. PostgREST works with column-level grants as long
--   as requests name only granted columns; src/lib/data/events.ts
--   was updated in the same change to request the explicit column
--   list instead of `*`.
--
-- NOT fixed here (flagged for Steve — see audit finding 3):
--   Write policies check `auth.role() = 'authenticated'` broadly and
--   20260208000002_expose_schema.sql grants ALL to authenticated, so
--   any authenticated user can write core tables. Mitigation depends
--   on the dashboard signup settings or pinning policies to the
--   specific admin UID — requires the admin UID, do not guess.
-- ═══════════════════════════════════════════════════════════════

-- ── Fix 1: per-function search_path ──

ALTER FUNCTION distraction.update_updated_at() SET search_path = distraction, public;
ALTER FUNCTION distraction.ensure_current_week() SET search_path = distraction, public;
ALTER FUNCTION distraction.compute_week_stats(TEXT) SET search_path = distraction, public;
ALTER FUNCTION distraction.freeze_week(TEXT) SET search_path = distraction, public;
ALTER FUNCTION distraction.auto_freeze_events() SET search_path = distraction, public;
ALTER FUNCTION distraction.create_week_snapshot(DATE, TEXT) SET search_path = distraction, public;

-- ── Fix 2: score_changes column-level read access ──
-- service_role retains full access (granted separately in
-- 20260208000002_expose_schema.sql and bypasses RLS anyway).
-- INSERT/UPDATE/DELETE grants to authenticated are untouched.

REVOKE SELECT ON distraction.score_changes FROM anon, authenticated;

GRANT SELECT (
    id,
    event_id,
    week_id,
    changed_at,
    changed_by,
    change_type,
    old_a_score,
    new_a_score,
    old_b_score,
    new_b_score,
    old_list,
    new_list,
    reason,
    version_before,
    version_after
) ON distraction.score_changes TO anon, authenticated;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
