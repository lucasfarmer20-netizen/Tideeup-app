'use client';

import { createClient } from '@/lib/supabase/client.js';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

/**
 * Returns the current Supabase auth session, or null if not signed in.
 * Subscribes to auth state changes so it updates when a magic link is clicked.
 */
export function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return session;
}
