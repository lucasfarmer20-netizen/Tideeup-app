'use client';

import { Zap, Clock, Sparkles, Calendar } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import type { TimePreference } from '@/lib/engine/types.js';
import type { QuizState } from '@/hooks/useQuiz';

interface Props {
  state: QuizState;
  set: <K extends keyof QuizState>(key: K, value: QuizState[K]) => void;
  advance: () => void;
  back: () => void;
  canAdvance: boolean;
}

const OPTIONS: {
  value: TimePreference;
  label: string;
  tagline: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: 'quick',
    label: 'Quick',
    tagline: '15–20 min/day',
    detail: 'Essentials only — dishes, basics, pet care',
    icon: Zap,
  },
  {
    value: 'steady',
    label: 'Steady',
    tagline: '30–40 min/day',
    detail: 'Balanced — most families choose this',
    icon: Clock,
  },
  {
    value: 'thorough',
    label: 'Thorough',
    tagline: '50–60 min/day',
    detail: 'Full coverage across every zone each week',
    icon: Sparkles,
  },
  {
    value: 'batch',
    label: 'Batch cleaner',
    tagline: 'Light weekdays, big sessions on weekends',
    detail: '~15 min Mon–Fri, ~2 hrs each weekend day',
    icon: Calendar,
  },
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
          We'll fit your plan around this — not the other way around.
        </p>
      </div>

      <div className="space-y-3">
        {OPTIONS.map((opt) => {
          const isSelected = state.timePreference === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              onClick={() => set('timePreference', opt.value)}
              className={cn(
                'w-full flex items-center gap-4 rounded-xl border-2 px-5 py-4 text-left transition-all hover:border-primary/50 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-card',
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
                <div className="flex items-baseline gap-2">
                  <p className={cn('font-semibold', isSelected && 'text-primary')}>
                    {opt.label}
                  </p>
                  <span className="text-xs text-muted-foreground">{opt.tagline}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{opt.detail}</p>
              </div>
              {isSelected && (
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
              )}
            </button>
          );
        })}
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
