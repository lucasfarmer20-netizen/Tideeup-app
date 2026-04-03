'use client';

import { Building2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import type { FlooringType, HomeType } from '@/lib/engine/types.js';
import type { QuizState } from '@/hooks/useQuiz';

interface Props {
  state: QuizState;
  set: <K extends keyof QuizState>(key: K, value: QuizState[K]) => void;
  advance: () => void;
  back: () => void;
  canAdvance: boolean;
}

const HOME_TYPE_OPTIONS: { value: HomeType; label: string; sub: string; emoji: string }[] = [
  { value: 'apartment',     label: 'Apartment / Condo', sub: 'No yard, shared building',          emoji: '🏢' },
  { value: 'townhouse',     label: 'Townhouse',          sub: 'Multi-floor, small outdoor',        emoji: '🏠' },
  { value: 'single-family', label: 'Single family home', sub: 'Full yard, driveway, garage',       emoji: '🏡' },
  { value: 'large-home',    label: 'Large home / Farm',  sub: 'Estate-size or rural property',     emoji: '🏘️' },
];

const FLOORING_OPTIONS: { value: FlooringType; label: string; sub: string }[] = [
  { value: 'hardwood', label: 'Hardwood', sub: 'or laminate' },
  { value: 'carpet',   label: 'Carpet',   sub: 'any pile'     },
  { value: 'tile',     label: 'Tile',     sub: 'or stone'     },
  { value: 'mixed',    label: 'Mixed',    sub: 'multiple types'},
];

export function HomeDetailsStep({ state, set, advance, back, canAdvance }: Props) {
  function selectHomeType(value: HomeType) {
    set('homeType', value);
  }

  function toggleFlooring(value: FlooringType) {
    const current = state.flooringTypes;
    const next = current.includes(value)
      ? current.filter((f) => f !== value)
      : [...current, value];
    set('flooringTypes', next);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Tell us about your home</h2>
        <p className="text-muted-foreground">
          This shapes which tasks you get and how long they take.
        </p>
      </div>

      {/* Home type — single select */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Home type</p>
        <div className="grid grid-cols-2 gap-3">
          {HOME_TYPE_OPTIONS.map((opt) => {
            const isSelected = state.homeType === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => selectHomeType(opt.value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-4 text-center transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card',
                )}
              >
                <span className="text-2xl">{opt.emoji}</span>
                <p className={cn('text-sm font-semibold leading-tight', isSelected && 'text-primary')}>
                  {opt.label}
                </p>
                <p className="text-xs text-muted-foreground leading-tight">{opt.sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Flooring type — multi select */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium">Flooring types in your home</p>
          <p className="text-xs text-muted-foreground">Select all that apply</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {FLOORING_OPTIONS.map((opt) => {
            const isSelected = state.flooringTypes.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleFlooring(opt.value)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card',
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0',
                    isSelected ? 'border-primary bg-primary' : 'border-muted-foreground',
                  )}
                >
                  {isSelected && (
                    <span className="text-primary-foreground text-xs font-bold leading-none">✓</span>
                  )}
                </div>
                <div className="text-left">
                  <p className={cn('text-sm font-semibold', isSelected && 'text-primary')}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{opt.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
        {state.flooringTypes.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Pick at least one flooring type to continue.
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={back} className="flex-1">
          ← Back
        </Button>
        <Button onClick={advance} disabled={!canAdvance} className="flex-[2]">
          Next →
        </Button>
      </div>
    </div>
  );
}
