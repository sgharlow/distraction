// Browser-side Supabase client (uses anon key, respects RLS)
// Targets the 'distraction' schema to isolate from other apps sharing this DB.
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'distraction' },
    },
  );
}
