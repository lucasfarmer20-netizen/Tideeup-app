'use client';

import { Home } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import type { HomeSize } from '@/lib/engine/types.js';
import type { QuizState } from '@/hooks/useQuiz';

interface Props {
  state: QuizState;
  set: <K extends keyof QuizState>(key: K, value: QuizState[K]) => void;
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
  function select(value: HomeSize) {
    set('homeSize', value);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <Home className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">How big is your home?</h2>
        <p className="text-muted-foreground">
          This helps us estimate how long each task takes.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((opt) => {
          const isSelected = state.homeSize === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-all hover:border-primary/50 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-sm'
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
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      <Button
        onClick={advance}
        disabled={!canAdvance}
        size="lg"
        className="w-full"
      >
        Next →
      </Button>
    </div>
  );
}
