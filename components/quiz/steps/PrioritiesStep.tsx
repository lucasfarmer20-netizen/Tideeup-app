'use client';

import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '../ChoiceRow';
import type { Priority } from '@/lib/engine/types.js';
import type { QuizState } from '@/hooks/useQuiz';

interface Props {
  state: QuizState;
  set: <K extends keyof QuizState>(key: K, value: QuizState[K]) => void;
  advance: () => void;
  back: () => void;
  canAdvance: boolean;
}

const MAX_PICKS = 2;

export function PrioritiesStep({ state, set, advance, back, canAdvance }: Props) {
  const hasPets = state.petTypes.length > 0;

  const choices: { value: Priority; label: string; sub: string }[] = [
    { value: 'kitchen-reset', label: 'Kitchen reset every night', sub: 'Dishes done, counters clear' },
    { value: 'bathrooms',     label: 'Bathrooms stay fresh',      sub: 'Never behind on the bathroom' },
    { value: 'floors',        label: 'Floors',                    sub: 'Vacuumed and swept on schedule' },
    { value: 'clutter',       label: 'Clutter and surfaces',      sub: 'Pickup and tidy, every day' },
    ...(hasPets
      ? [{ value: 'pet-mess' as Priority, label: 'Pet mess', sub: 'Hair, bowls, litter, bedding' }]
      : []),
  ];

  function toggle(v: Priority) {
    const current = state.priorities;
    if (current.includes(v)) {
      set('priorities', current.filter((p) => p !== v));
    } else if (current.length < MAX_PICKS) {
      set('priorities', [...current, v]);
    } else {
      // Replace the oldest pick so tapping always does something.
      set('priorities', [current[1]!, v]);
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <Heart className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">What matters most?</h2>
        <p className="text-muted-foreground">
          Pick up to two. When a week gets tight, these are the things we never cut.
        </p>
      </div>

      <ChoiceRow
        label={`${state.priorities.length} of ${MAX_PICKS} picked`}
        choices={choices}
        value={state.priorities}
        onSelect={toggle}
        cards
      />

      <div className="flex gap-3">
        <Button onClick={back} variant="outline" size="lg" className="flex-1">
          ← Back
        </Button>
        <Button onClick={advance} disabled={!canAdvance} size="lg" className="flex-1">
          {state.priorities.length === 0 ? 'Skip →' : 'Next →'}
        </Button>
      </div>
    </div>
  );
}
