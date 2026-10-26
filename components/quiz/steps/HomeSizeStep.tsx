'use client';

import { useState } from 'react';
import { Home } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '../ChoiceRow';
import type { HomeSize } from '@/lib/engine/types.js';
import type { QuizState } from '@/hooks/useQuiz';

interface Props {
  state: QuizState;
  set: <K extends keyof QuizState>(key: K, value: QuizState[K]) => void;
  setAndAdvance: <K extends keyof QuizState>(key: K, value: QuizState[K]) => void;
  advance: () => void;
  canAdvance: boolean;
}

const OPTIONS: { value: HomeSize; label: string; rooms: string; emoji: string }[] = [
  { value: 'S', label: 'Small',       rooms: 'Studio or 1 bedroom',  emoji: '🏠' },
  { value: 'M', label: 'Medium',      rooms: '2–3 bedrooms',         emoji: '🏡' },
  { value: 'L', label: 'Large',       rooms: '4–5 bedrooms',         emoji: '🏘️' },
  { value: 'XL', label: 'Extra large', rooms: '6+ bedrooms or estate', emoji: '🏰' },
];

export function HomeSizeStep({ state, set, advance, canAdvance }: Props) {
  const [pendingSize, setPendingSize] = useState<HomeSize | null>(null);

  function select(value: HomeSize) {
    setPendingSize(value);
    set('homeSize', value);
  }

  const activeSize = pendingSize ?? state.homeSize;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <Home className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">How big is your home?</h2>
        <p className="text-muted-foreground">
          Tap your home size — this calibrates how long each task takes.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((opt) => {
          const isSelected = activeSize === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => select(opt.value)}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-all hover:border-primary/50 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-sm scale-[1.01]'
                  : 'border-border bg-card',
              )}
            >
              <span className="text-3xl">{opt.emoji}</span>
              <div>
                <p className={cn('font-semibold', isSelected && 'text-primary')}>
                  {opt.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.rooms}</p>
              </div>
              {isSelected && (
                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      <ChoiceRow
        label="How many bathrooms?"
        hint="Bathrooms are the biggest driver of weekly time."
        choices={[
          { value: 1, label: '1' },
          { value: 2, label: '2' },
          { value: 3, label: '3' },
          { value: 4, label: '4+' },
        ]}
        value={state.bathrooms}
        onSelect={(v) => set('bathrooms', v)}
      />

      <ChoiceRow
        label="How many floors?"
        choices={[
          { value: 1, label: 'One level' },
          { value: 2, label: 'Two or more' },
        ]}
        value={state.floors}
        onSelect={(v) => set('floors', v === 2 ? 2 : 1)}
      />

      {state.homeSize && (
        <Button
          onClick={advance}
          disabled={!canAdvance}
          size="lg"
          className="w-full"
        >
          Next →
        </Button>
      )}
    </div>
  );
}
