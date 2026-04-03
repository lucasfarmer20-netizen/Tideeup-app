import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types.js';

/**
 * Supabase browser client — use in Client Components only.
 * Uses the anon key; subject to RLS.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
