'use client';

import { Clock, Zap, Scale, Sparkles, Flame } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '../ChoiceRow';
import type { QuizState } from '@/hooks/useQuiz';

interface Props {
  state: QuizState;
  set: <K extends keyof QuizState>(key: K, value: QuizState[K]) => void;
  setAndAdvance: <K extends keyof QuizState>(key: K, value: QuizState[K]) => void;
  advance: () => void;
  back: () => void;
  canAdvance: boolean;
}

// Hours per week. The engine turns this into per-day budgets using the
// distribution below (see lib/engine/profile.ts). Values must match
// WEEKLY_HOURS_OPTIONS in hooks/useQuiz.ts.
const HOURS_OPTIONS: {
  value: number;
  label: string;
  tagline: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}[] = [
  { value: 2,   label: 'About 2 hours',  tagline: '~15 min a day',   detail: 'The essentials, kept up',            icon: Zap },
  { value: 3.5, label: '3–4 hours',      tagline: '~30 min a day',   detail: 'Balanced — most families land here', icon: Scale, badge: 'Most common' },
  { value: 6,   label: '5–7 hours',      tagline: '~50 min a day',   detail: 'Full coverage of every zone',       icon: Sparkles },
  { value: 9,   label: '8+ hours',       tagline: '~75 min a day',   detail: 'Big home, high standards, or both',  icon: Flame },
];

export function TimePreferenceStep({ state, set, advance, back, canAdvance }: Props) {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <Clock className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">How much time can you give?</h2>
        <p className="text-muted-foreground">
          Be honest — a plan that fits the time you really have beats one you abandon.
        </p>
      </div>

      <div className="space-y-3">
        {HOURS_OPTIONS.map((opt) => {
          const isSelected = state.weeklyHours === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => set('weeklyHours', opt.value)}
              className={cn(
                'w-full flex items-center gap-4 rounded-xl border-2 px-5 py-4 text-left transition-all hover:border-primary/50 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card',
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full shrink-0',
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={cn('font-semibold', isSelected && 'text-primary')}>{opt.label}</p>
                  <span className="text-xs text-muted-foreground">{opt.tagline}</span>
                  {opt.badge && (
                    <span className="text-[11px] font-semibold bg-sage/25 text-foreground px-2 py-0.5 rounded-pill">
                      {opt.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{opt.detail}</p>
              </div>
            </button>
          );
        })}
      </div>

      <ChoiceRow
        label="When does that time happen?"
        choices={[
          { value: 'spread',   label: 'A bit every day' },
          { value: 'weekends', label: 'Mostly weekends' },
          { value: 'weekdays', label: 'Mostly weekdays' },
        ]}
        value={state.distribution}
        onSelect={(v) => set('distribution', v)}
      />

      <div className="flex gap-3">
        <Button onClick={back} variant="outline" size="lg" className="flex-1">
          ← Back
        </Button>
        <Button onClick={advance} disabled={!canAdvance} size="lg" className="flex-1">
          Next →
        </Button>
      </div>
    </div>
  );
}
