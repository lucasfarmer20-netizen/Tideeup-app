'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useQuiz } from '@/hooks/useQuiz';
import { ProgressBar } from './ProgressBar';
import { HomeSizeStep } from './steps/HomeSizeStep';
import { HomeDetailsStep } from './steps/HomeDetailsStep';
import { HouseholdStep } from './steps/HouseholdStep';
import { TimePreferenceStep } from './steps/TimePreferenceStep';
import { PrioritiesStep } from './steps/PrioritiesStep';
import { ReviewStep } from './steps/ReviewStep';

const TOTAL_STEPS = 6;

function QuizContent() {
  const { state, set, setAndAdvance, advance, back, goToStep, canAdvance } = useQuiz();
  const stepProps = { state, set, setAndAdvance, advance, back, goToStep, canAdvance };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-surface/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-2 mb-4">
            <Link href="/" className="text-2xl font-display font-semibold text-primary">
              TideeUp
            </Link>
            <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-pill">
              Takes ~60 sec
            </span>
          </div>
          <ProgressBar currentStep={state.step} totalSteps={TOTAL_STEPS} />
        </div>
      </header>

      {/* Step content */}
      <main className="max-w-lg mx-auto px-4 py-8">
        {state.step === 1 && <HomeSizeStep {...stepProps} />}
        {state.step === 2 && <HomeDetailsStep {...stepProps} />}
        {state.step === 3 && <HouseholdStep {...stepProps} />}
        {state.step === 4 && <TimePreferenceStep {...stepProps} />}
        {state.step === 5 && <PrioritiesStep {...stepProps} />}
        {state.step === 6 && <ReviewStep {...stepProps} />}
      </main>
    </div>
  );
}

export function QuizShell() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <span className="text-muted-foreground">Loading…</span>
        </div>
      }
    >
      <QuizContent />
    </Suspense>
  );
}
