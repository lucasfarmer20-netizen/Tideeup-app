'use client';

import { Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '../ChoiceRow';
import type { HomeType } from '@/lib/engine/types.js';
import type { QuizState } from '@/hooks/useQuiz';

interface Props {
  state: QuizState;
  set: <K extends keyof QuizState>(key: K, value: QuizState[K]) => void;
  advance: () => void;
  back: () => void;
}

/** Mowing is only asked of (and planned for) homes that can have a lawn. */
export function hasYard(homeType: HomeType | null): boolean {
  return homeType === 'single-family' || homeType === 'large-home';
}

type YesNo = 'yes' | 'no';
const YES_NO: readonly { value: YesNo; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];
const toYesNo = (v: boolean | null): YesNo | null => (v === null ? null : v ? 'yes' : 'no');

/**
 * Four taps that change how long the same chore takes. Every question is
 * optional: skipping one keeps the typical estimate for that task.
 */
export function SetupStep({ state, set, advance, back }: Props) {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <Wrench className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Your setup</h2>
        <p className="text-muted-foreground">
          The same chore takes very different time depending on what you have. Skip any you like.
        </p>
      </div>

      <ChoiceRow
        label="How do dishes get done?"
        cards
        choices={[
          { value: 'dishwasher', label: 'Dishwasher', sub: 'Load, run, unload' },
          { value: 'hand', label: 'By hand', sub: 'Wash, dry, put away' },
        ] as const}
        value={state.dishes}
        onSelect={(v) => set('dishes', v)}
      />

      <ChoiceRow
        label="Do you have a robot vacuum?"
        choices={YES_NO}
        value={toYesNo(state.robotVacuum)}
        onSelect={(v) => set('robotVacuum', v === 'yes')}
      />

      <ChoiceRow
        label="Where do you do laundry?"
        cards
        choices={[
          { value: 'in-home', label: 'At home', sub: 'Washer and dryer in your home' },
          { value: 'shared', label: 'Shared or laundromat', sub: 'Building laundry room or off-site' },
        ] as const}
        value={state.laundry}
        onSelect={(v) => set('laundry', v)}
      />

      {hasYard(state.homeType) && (
        <ChoiceRow
          label="Do you mow a lawn yourself?"
          choices={YES_NO}
          value={toYesNo(state.lawn)}
          onSelect={(v) => set('lawn', v === 'yes')}
        />
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={back} className="flex-1">
          ← Back
        </Button>
        <Button onClick={advance} className="flex-[2]">
          Next →
        </Button>
      </div>
    </div>
  );
}
