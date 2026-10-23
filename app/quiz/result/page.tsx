'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, BookmarkCheck, Sparkles } from 'lucide-react';
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
  const [capturedEmail, setCapturedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check auth state on mount; authenticated users skip the gate
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

  const handleReveal = useCallback(
    (email?: string) => {
      if (email) setCapturedEmail(email);
      setIsRevealed(true);
      // Update the URL for bookmarking without navigating away.
      // Staying on this page keeps the upgrade prompts (LockedFeature blocks)
      // visible immediately after the reveal.
      if (planId) {
        window.history.replaceState(null, '', `/plan/${planId}`);
      }
    },
    [planId],
  );

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

  const pricingHref = capturedEmail
    ? `/pricing?email=${encodeURIComponent(capturedEmail)}`
    : '/pricing';

  return (
    <div className="relative">
      {!plan ? (
        <PlanSkeleton />
      ) : (
        <>
          {/* WeekPlanView keeps the top Week Header crisp and blurs the 7-day grid until revealed */}
          <WeekPlanView plan={plan} planId={planId ?? undefined} isBlurred={!isRevealed} />

          {/* Email gate overlay — only for anonymous users */}
          {!isRevealed && isAuthenticated === false && planId && (
            <EmailRevealGate
              planId={planId}
              onReveal={handleReveal}
              totalTasks={plan.metadata.totalTasksScheduled}
              totalMinutes={plan.metadata.totalMinutesPlanned}
            />
          )}

          {/* Post-reveal confirmation & Pro upgrade banner */}
          {isRevealed && (
            <div className="mt-8 rounded-2xl bg-surface border-2 border-primary/25 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <BookmarkCheck className="w-4 h-4 text-primary shrink-0" />
                  <p className="font-semibold">
                    Plan unlocked{capturedEmail ? ` & sent to ${capturedEmail}` : ''}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Want TideeUp to remember what you cleaned this week, assign tasks to family members, and send a fresh plan every Sunday?
                </p>
              </div>
              <Button asChild size="default" className="shrink-0 w-full sm:w-auto">
                <Link href={pricingHref}>
                  <Sparkles className="w-4 h-4" />
                  Upgrade to Pro — from $5/mo
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
      <header className="border-b border-border/60 bg-surface/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-display font-semibold text-primary">
            TideeUp
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-medium text-primary hover:underline"
          >
            Explore Pro →
          </Link>
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
