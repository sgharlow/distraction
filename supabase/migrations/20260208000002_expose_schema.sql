-- ═══════════════════════════════════════════════════════════════
-- Expose the 'distraction' schema to PostgREST (Supabase API)
-- Run this AFTER creating the schema but BEFORE using the API.
--
-- This tells PostgREST to include the 'distraction' schema
-- in addition to the default 'public' schema.
-- ═══════════════════════════════════════════════════════════════

-- Grant usage on the schema to the roles Supabase uses
GRANT USAGE ON SCHEMA distraction TO anon;
GRANT USAGE ON SCHEMA distraction TO authenticated;
GRANT USAGE ON SCHEMA distraction TO service_role;

-- Grant select on all current and future tables to anon (for public reads)
GRANT SELECT ON ALL TABLES IN SCHEMA distraction TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA distraction GRANT SELECT ON TABLES TO anon;

-- Grant full access to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA distraction TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA distraction GRANT ALL ON TABLES TO authenticated;

-- Grant full access to service_role (bypasses RLS anyway, but needs schema access)
GRANT ALL ON ALL TABLES IN SCHEMA distraction TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA distraction GRANT ALL ON TABLES TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA distraction TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA distraction TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA distraction TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA distraction GRANT EXECUTE ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA distraction GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA distraction GRANT EXECUTE ON FUNCTIONS TO service_role;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA distraction TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA distraction TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA distraction TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA distraction GRANT USAGE ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA distraction GRANT USAGE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA distraction GRANT USAGE ON SEQUENCES TO service_role;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
