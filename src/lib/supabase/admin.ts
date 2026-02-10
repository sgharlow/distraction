// Service-role Supabase client — bypasses RLS.
// ONLY use in API routes and server-side scripts, never in client code.
// Targets the 'distraction' schema to isolate from other apps sharing this DB.
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: 'distraction' },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
