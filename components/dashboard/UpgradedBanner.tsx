'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client.js';

interface UpgradedBannerProps {
  /** Whether the server already confirmed tier=paid at render time */
  initialIsPaid: boolean;
}

export function UpgradedBanner({ initialIsPaid }: UpgradedBannerProps) {
  const router = useRouter();
  const [isPaid, setIsPaid]   = useState(initialIsPaid);
  const [polling, setPolling] = useState(!initialIsPaid);
  const [gave_up, setGaveUp]  = useState(false);

  useEffect(() => {
    if (initialIsPaid) return; // webhook already fired, nothing to poll

    let attempts = 0;
    const MAX_ATTEMPTS = 5; // 5 × 2s = 10s

    const id = setInterval(async () => {
      attempts++;
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user.email) { clearInterval(id); setPolling(false); return; }

        const { data } = await supabase
          .from('users')
          .select('tier')
          .eq('email', session.user.email)
          .single();

        if ((data as { tier?: string } | null)?.tier === 'paid') {
          setIsPaid(true);
          setPolling(false);
          clearInterval(id);
          // Clean the ?upgraded param and force a server re-render
          router.replace('/dashboard');
        }
      } catch {
        // ignore — try again next tick
      }

      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(id);
        setPolling(false);
        setGaveUp(true);
      }
    }, 2000);

    return () => clearInterval(id);
  }, [initialIsPaid, router]);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-3 flex items-center gap-3">
      <Sparkles className="w-4 h-4 text-primary shrink-0" />
      {isPaid ? (
        <p className="text-sm font-medium text-primary">
          Welcome to TideeUp Pro! Your plan is ready.
        </p>
      ) : polling ? (
        <p className="text-sm text-muted-foreground">
          Activating your subscription…
          <span className="ml-2 inline-block w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin align-middle" />
        </p>
      ) : gave_up ? (
        <p className="text-sm text-muted-foreground">
          Subscription activation is taking a moment.{' '}
          <button onClick={() => router.refresh()} className="text-primary underline hover:no-underline">
            Refresh
          </button>{' '}
          to check.
        </p>
      ) : null}
    </div>
  );
}
