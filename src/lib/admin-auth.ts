import { createClient } from '@/lib/supabase/server';

/**
 * Check admin auth from server context (API routes and server actions).
 * Returns the user if authenticated, null otherwise.
 */
export async function getAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
