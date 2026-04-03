'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { WeekPlanView } from '@/components/plan/WeekPlanView';
import { EmailRevealGate } from '@/components/reveal/EmailRevealGate';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { safeDeserializeWeekPlan } from '@/utils/serialize';
import { createClient } from '@/lib/supabase/client';
import type { WeekPlan } from '@/lib/engine/types.js';

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PlanSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Main result content ──────────────────────────────────────────────────────

function ResultContent() {
  const params = useSearchParams();
  const router = useRouter();

  // Latch the planId so it survives window.history.replaceState changing the URL
  // from /quiz/result?planId=xxx to /plan/xxx (which drops the query param and
  // would cause useSearchParams to return null on the next render).
  const planIdParam = params.get('planId');
  const planIdRef = useRef(planIdParam);
  if (planIdParam) planIdRef.current = planIdParam;
  const planId = planIdRef.current;

  const [plan, setPlan] = useState<WeekPlan | null>(null);
  // null = auth check in progress (prevents gate flash for signed-in users)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bug 1 fix: check auth state on mount; authenticated users skip the gate
  // and are sent straight to the dashboard (plan is already saved to their account).
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user) {
          setIsAuthenticated(true);
          router.replace('/dashboard');
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => setIsAuthenticated(false));
  }, [router]);

  useEffect(() => {
    if (!planId) return;

    // Try sessionStorage first (fastest — no round-trip)
    const stored = sessionStorage.getItem('tideeup_draft_plan');
    if (stored) {
      try {
        const { planId: storedId, weekPlan } = JSON.parse(stored) as {
          planId: string;
          weekPlan: unknown;
        };
        if (storedId === planId) {
          const deserialized = safeDeserializeWeekPlan(weekPlan);
          if (deserialized) {
            setPlan(deserialized);
            return;
          }
        }
      } catch {
        // Fall through to API fetch
      }
    }

    // Fallback: fetch from API
    fetch(`/api/plan/${planId}`)
      .then((r) => r.json())
      .then((data: { weekPlan: unknown }) => {
        const deserialized = safeDeserializeWeekPlan(data.weekPlan);
        if (deserialized) setPlan(deserialized);
        else setError('Could not load your plan.');
      })
      .catch(() => setError('Failed to load your plan. Please try again.'));
  }, [planId]);

  const handleReveal = useCallback(() => {
    setIsRevealed(true);
    // Update the URL for bookmarking without navigating away.
    // Staying on this page keeps the upgrade prompts (LockedFeature blocks)
    // visible immediately after the reveal.
    if (planId) {
      window.history.replaceState(null, '', `/plan/${planId}`);
    }
  }, [planId]);

  if (!planId) {
    // Auth check is still in-flight — show skeleton while the redirect resolves
    // so authenticated users never see "No plan ID found" as a flash.
    if (isAuthenticated === null) return <PlanSkeleton />;
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <p className="text-muted-foreground">No plan ID found.</p>
        <Button asChild variant="outline">
          <Link href="/quiz">Start over</Link>
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <p className="text-destructive">{error}</p>
        <Button asChild variant="outline">
          <Link href="/quiz">Try again</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      {!plan ? (
        <PlanSkeleton />
      ) : (
        <>
          {/* Plan content — blurred until revealed (or until auth check resolves) */}
          <div
            className={`transition-all duration-700 ${
              isRevealed ? 'blur-0' : 'blur-md select-none pointer-events-none'
            }`}
          >
            <WeekPlanView plan={plan} planId={planId ?? undefined} isBlurred={!isRevealed} />
          </div>

          {/* Email gate overlay — only for anonymous users */}
          {!isRevealed && isAuthenticated === false && planId && (
            <EmailRevealGate planId={planId} onReveal={handleReveal} />
          )}

          {/* Post-reveal CTA strip */}
          {isRevealed && (
            <div className="mt-8 rounded-xl bg-primary/5 border border-primary/20 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
              <div>
                <p className="font-semibold">Bookmark this page</p>
                <p className="text-sm text-muted-foreground">
                  Come back each Monday — your plan lives at this URL.
                </p>
              </div>
              <Button asChild size="sm">
                <Link href="/">
                  Learn about Pro
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuizResultPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-primary">TideeUp</Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Suspense fallback={<PlanSkeleton />}>
          <ResultContent />
        </Suspense>
      </main>
    </div>
  );
}
