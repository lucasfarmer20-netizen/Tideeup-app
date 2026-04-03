import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase admin client — use in Server Components and API routes only.
 * Uses the service role key; BYPASSES RLS.
 *
 * Never import this in Client Components. The `server-only` import above
 * will throw a build error if you try.
 *
 * NOTE: The generic Database type is intentionally omitted here.
 * Phase 2 uses hand-written types in lib/supabase/types.ts for documentation;
 * once Supabase CLI is set up, run `supabase gen types typescript` and restore
 * the generic: `createSupabaseClient<Database>(url, key, ...)`.
 * Until then, each API route casts query results to the expected shape explicitly.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars',
    );
  }

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
