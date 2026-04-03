'use client';

import { Suspense } from 'react';
import { useQuiz } from '@/hooks/useQuiz';
import { ProgressBar } from './ProgressBar';
import { HomeSizeStep } from './steps/HomeSizeStep';
import { HomeDetailsStep } from './steps/HomeDetailsStep';
import { HouseholdStep } from './steps/HouseholdStep';
import { TimePreferenceStep } from './steps/TimePreferenceStep';
import { ReviewStep } from './steps/ReviewStep';

const TOTAL_STEPS = 5;

function QuizContent() {
  const { state, set, advance, back, canAdvance } = useQuiz();
  const stepProps = { state, set, advance, back, canAdvance };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl font-bold text-primary">TideeUp</span>
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
        {state.step === 5 && <ReviewStep {...stepProps} />}
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
