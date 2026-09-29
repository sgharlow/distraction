-- ═══════════════════════════════════════════════════════════════
-- Email subscribers — double opt-in (2026-09-28)
--
-- The table always had `confirmed BOOLEAN DEFAULT false`, and the weekly mail
-- (src/lib/blog/cascade.ts) only sends to confirmed rows, but nothing ever set
-- confirmed = true. This adds the confirmation token storage used by
-- POST /api/subscribe (issues a token) and GET /api/subscribe/confirm (sets
-- confirmed = true via the service role).
--
-- NOT YET APPLIED. Apply before deploying the code that reads these columns.
-- Additive only: no rows are changed or deleted; existing unconfirmed rows
-- stay unconfirmed until they re-subscribe or a re-confirm policy is decided.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE distraction.email_subscribers
    ADD COLUMN IF NOT EXISTS confirmation_token_hash TEXT,
    ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Only the SHA-256 of the emailed token is stored. Unique so one hash maps to
-- at most one row; partial so the many NULLs do not collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_subscribers_confirmation_token_hash
    ON distraction.email_subscribers (confirmation_token_hash)
    WHERE confirmation_token_hash IS NOT NULL;

-- Public role: INSERT of the email column ONLY.
--
-- 1. The public insert path needs an explicit INSERT grant. Tables created
--    after 20260208000002 inherit that migration's default privileges, which
--    give anon SELECT only — the same gap that forced /api/contact onto the
--    service-role client (commit 8d8b4e9). The subscribe route still inserts
--    with the anon client, so without this grant signups are expected to fail
--    with 42501 (the table held 0 rows on 2026-09-28; not proven live —
--    check: SELECT has_table_privilege('anon','distraction.email_subscribers','INSERT');).
-- 2. A column-level grant makes the double opt-in structural: with a
--    table-wide grant the public role could POST {"confirmed": true} (or a
--    token hash of its choosing) straight to the REST API and skip the email.
REVOKE INSERT ON distraction.email_subscribers FROM anon;
GRANT INSERT (email) ON distraction.email_subscribers TO anon;

NOTIFY pgrst, 'reload schema';
