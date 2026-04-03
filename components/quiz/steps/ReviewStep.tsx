'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { QuizState } from '@/hooks/useQuiz';
import type { GeneratePlanRequest, GeneratePlanResponse } from '@/types/api';
import type { PetType } from '@/lib/engine/types.js';

interface Props {
  state: QuizState;
  back: () => void;
  canAdvance: boolean;
}

const HOME_SIZE_LABELS = {
  S:  '🏠 Small — Studio or 1 bedroom',
  M:  '🏡 Medium — 2–3 bedrooms',
  L:  '🏘️ Large — 4–5 bedrooms',
  XL: '🏰 Extra large — 6+ bedrooms',
};

const HOME_TYPE_LABELS = {
  'apartment':     '🏢 Apartment / Condo',
  'townhouse':     '🏠 Townhouse',
  'single-family': '🏡 Single family home',
  'large-home':    '🏘️ Large home / Farm',
};

const FLOORING_LABELS: Record<string, string> = {
  hardwood: 'Hardwood',
  carpet:   'Carpet',
  tile:     'Tile',
  mixed:    'Mixed',
};

const PET_LABELS: Record<PetType, string> = {
  'cat-1-2':          'Cat (1–2)',
  'cat-3-plus':       'Cats (3+)',
  'small-dog-1-2':    'Small dog (1–2)',
  'large-dog-1-2':    'Large dog (1–2)',
  'large-dog-3-plus': 'Large dogs (3+)',
  'small-animals':    'Birds / Fish / Small animals',
  'other':            'Other pets',
};

const TIME_LABELS: Record<string, string> = {
  quick:    '⚡ Quick — 15–20 min/day',
  steady:   '🕐 Steady — 30–40 min/day',
  thorough: '✨ Thorough — 50–60 min/day',
  batch:    '📅 Batch cleaner — weekday light, big weekends',
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

export function ReviewStep({ state, back, canAdvance }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!state.homeSize || !state.homeType || !state.timePreference) return;
    setIsLoading(true);
    setError(null);

    try {
      const body: GeneratePlanRequest = {
        homeSize:       state.homeSize,
        homeType:       state.homeType,
        householdCount: state.householdCount,
        petTypes:       state.petTypes,
        kids:           state.kids,
        flooringTypes:  state.flooringTypes,
        timePreference: state.timePreference,
      };

      const res = await fetch('/api/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? 'Failed to generate plan');
      }

      const data: GeneratePlanResponse = await res.json();

      sessionStorage.setItem(
        'tideeup_draft_plan',
        JSON.stringify({ planId: data.planId, weekPlan: data.weekPlan }),
      );

      if (data.isAuthenticated) {
        router.push(`/dashboard?planId=${data.planId}`);
      } else {
        router.push(`/quiz/result?planId=${data.planId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setIsLoading(false);
    }
  }

  // Build readable household summary
  const householdParts = [
    `${state.householdCount === 6 ? '6+' : state.householdCount} ${state.householdCount === 1 ? 'person' : 'people'}`,
    state.kids ? 'kids' : null,
  ].filter(Boolean).join(', ');

  const petSummary = state.petTypes.length === 0
    ? 'No pets'
    : state.petTypes.map((p) => PET_LABELS[p]).join(', ');

  const flooringSummary = state.flooringTypes
    .map((f) => FLOORING_LABELS[f] ?? f)
    .join(', ');

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Looks great — ready?</h2>
        <p className="text-muted-foreground">
          Here's what we'll use to build your plan.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5">
        {state.homeSize && (
          <SummaryRow label="Home size" value={HOME_SIZE_LABELS[state.homeSize]} />
        )}
        {state.homeType && (
          <SummaryRow label="Home type" value={HOME_TYPE_LABELS[state.homeType]} />
        )}
        {flooringSummary && (
          <SummaryRow label="Flooring" value={flooringSummary} />
        )}
        <SummaryRow label="Household" value={householdParts} />
        <SummaryRow label="Pets" value={petSummary} />
        {state.timePreference && (
          <SummaryRow
            label="Time per day"
            value={TIME_LABELS[state.timePreference] ?? state.timePreference}
          />
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive text-center rounded-lg bg-destructive/10 px-4 py-3">
          {error}
        </p>
      )}

      <Button
        onClick={handleGenerate}
        disabled={!canAdvance || isLoading}
        size="xl"
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" />
            Building your plan…
          </>
        ) : (
          'Generate my plan →'
        )}
      </Button>

      <Button variant="ghost" onClick={back} disabled={isLoading} className="w-full">
        ← Back
      </Button>
    </div>
  );
}
