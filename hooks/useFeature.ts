'use client';

import { createClient } from '@/lib/supabase/client.js';
import { useEffect, useState } from 'react';

export type PaidFeature =
  | 'rotation_memory'    // Smart task deduplication across weeks
  | 'member_assignment'  // Assign tasks to specific household members
  | 'plan_history'       // View past weeks' plans
  | 'custom_tasks'       // Add and edit tasks in the library
  | 'season_mode'        // Manual season override
  | 'sunday_email';      // Automated Sunday plan email

/**
 * Returns true if the current user has access to the given paid feature.
 *
 * Reads the user's tier from their Supabase auth session. While loading or
 * when no session exists, returns false (free-tier behaviour).
 *
 * All paid features gate on tier = 'paid'. The feature key is reserved for
 * per-feature granularity in a future sprint (e.g. gifted features, beta flags).
 *
 * Note: requires Supabase Auth to be wired up. Until then, always returns false.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useFeature(_feature: PaidFeature): boolean {
  const [isPaid, setIsPaid] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user.email) return;

      const { data } = await supabase
        .from('users')
        .select('tier')
        .eq('email', session.user.email)
        .single();

      if ((data as { tier?: string } | null)?.tier === 'paid') {
        setIsPaid(true);
      }
    });
  }, []);

  return isPaid;
}
