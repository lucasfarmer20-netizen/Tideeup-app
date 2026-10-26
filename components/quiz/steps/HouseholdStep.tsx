'use client';

import { Users, Minus, Plus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import type { KidAges, PetType } from '@/lib/engine/types.js';
import type { QuizState } from '@/hooks/useQuiz';

interface Props {
  state: QuizState;
  set: <K extends keyof QuizState>(key: K, value: QuizState[K]) => void;
  advance: () => void;
  back: () => void;
}

const KID_BANDS: { key: keyof KidAges; label: string; emoji: string }[] = [
  { key: 'under5',   label: 'Under 5',     emoji: '🧸' },
  { key: 'age5to12', label: 'Ages 5–12',   emoji: '🎒' },
  { key: 'teen',     label: 'Teens',       emoji: '🎧' },
];

function Counter({
  value, min, max, onChange, unit, compact = false,
}: {
  value: number; min: number; max: number; onChange: (v: number) => void; unit?: string; compact?: boolean;
}) {
  const btn = cn(
    'flex items-center justify-center rounded-full border-2 border-border bg-card hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors',
    compact ? 'w-9 h-9' : 'w-12 h-12',
  );
  return (
    <div className={cn('flex items-center justify-center', compact ? 'gap-3' : 'gap-6')}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} className={btn} aria-label="Fewer">
        <Minus className="w-4 h-4" />
      </button>
      <div className={cn('text-center', compact ? 'min-w-[1.5rem]' : 'min-w-[4rem]')}>
        <span className={cn('font-bold text-primary tabular-nums', compact ? 'text-xl' : 'text-5xl')}>
          {value === max && !compact ? `${value}+` : value}
        </span>
        {unit && <p className="text-xs text-muted-foreground mt-1">{unit}</p>}
      </div>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} className={btn} aria-label="More">
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

const PET_OPTIONS: { value: PetType; label: string; emoji: string }[] = [
  { value: 'cat-1-2',          label: 'Cat (1–2)',           emoji: '🐱' },
  { value: 'cat-3-plus',       label: 'Cats (3+)',           emoji: '🐈' },
  { value: 'small-dog-1-2',    label: 'Small dog (1–2)',     emoji: '🐶' },
  { value: 'large-dog-1-2',    label: 'Large dog (1–2)',     emoji: '🐕' },
  { value: 'large-dog-3-plus', label: 'Large dogs (3+)',     emoji: '🐩' },
  { value: 'small-animals',    label: 'Birds / Fish / Small animals', emoji: '🐠' },
  { value: 'other',            label: 'Other pets',          emoji: '🐾' },
];

export function HouseholdStep({ state, set, advance, back }: Props) {
  const noPets = state.petTypes.length === 0;

  function togglePet(value: PetType) {
    const current = state.petTypes;
    const next = current.includes(value)
      ? current.filter((p) => p !== value)
      : [...current, value];
    set('petTypes', next);
  }

  function clearPets() {
    set('petTypes', []);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Who lives in your home?</h2>
        <p className="text-muted-foreground">
          More people and pets means more tasks — and more hands to help.
        </p>
      </div>

      {/* Adults */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-center">Adults</p>
        <Counter
          value={state.adults}
          min={1}
          max={6}
          onChange={(v) => set('adults', v)}
          unit={state.adults === 1 ? 'adult' : 'adults'}
        />
      </div>

      {/* Kids by age */}
      <div className="space-y-3">
        <div className="text-center">
          <p className="text-sm font-medium">Kids at home</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Little ones add mess; teens can take a share of the work.
          </p>
        </div>
        <div className="space-y-2">
          {KID_BANDS.map((band) => (
            <div
              key={band.key}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{band.emoji}</span>
                <p className="text-sm font-medium">{band.label}</p>
              </div>
              <Counter
                compact
                value={state.kidAges[band.key]}
                min={0}
                max={6}
                onChange={(v) => set('kidAges', { ...state.kidAges, [band.key]: v })}
              />
            </div>
          ))}
        </div>
        {state.householdCount >= 6 && (
          <p className="text-xs text-muted-foreground text-center">
            Large households get scaled time estimates for shared spaces.
          </p>
        )}
      </div>

      {/* Pet types — multi-select */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium">Pets</p>
          <p className="text-xs text-muted-foreground">Select all that apply</p>
        </div>

        {/* No pets option */}
        <button
          onClick={clearPets}
          className={cn(
            'flex items-center gap-3 rounded-xl border-2 px-4 py-3 w-full transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            noPets ? 'border-primary bg-primary/5' : 'border-border bg-card',
          )}
        >
          <div
            className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
              noPets ? 'border-primary bg-primary' : 'border-muted-foreground',
            )}
          >
            {noPets && <span className="text-primary-foreground text-xs font-bold">✓</span>}
          </div>
          <div className="text-left">
            <p className={cn('text-sm font-semibold', noPets && 'text-primary')}>No pets</p>
          </div>
        </button>

        {/* Individual pet type chips */}
        <div className="grid grid-cols-2 gap-2">
          {PET_OPTIONS.map((opt) => {
            const isSelected = state.petTypes.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => togglePet(opt.value)}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl border-2 px-3 py-3 transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card',
                )}
              >
                <span className="text-xl shrink-0">{opt.emoji}</span>
                <div className="text-left min-w-0">
                  <p className={cn('text-xs font-semibold leading-snug', isSelected && 'text-primary')}>
                    {opt.label}
                  </p>
                </div>
                <div
                  className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ml-auto',
                    isSelected ? 'border-primary bg-primary' : 'border-muted-foreground',
                  )}
                >
                  {isSelected && (
                    <span className="text-primary-foreground text-[9px] font-bold leading-none">✓</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={back} className="flex-1">
          ← Back
        </Button>
        <Button onClick={advance} size="default" className="flex-[2]">
          Next →
        </Button>
      </div>
    </div>
  );
}
