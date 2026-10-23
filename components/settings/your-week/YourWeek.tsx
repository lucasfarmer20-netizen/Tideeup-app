'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2, Lock } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CoverageReadout } from './CoverageReadout';
import { DayRow } from './DayRow';
import { DAYS_MONDAY_FIRST, MAX_DAY_MINUTES } from './presets';

export interface YourWeekProps {
  /** Minutes per day, Monday first (index 0 = Mon … 6 = Sun). 0 = nothing that day. */
  value: number[]; // length 7, each 0–180, multiples of 15 (or preset values 10/20)
  onChange: (next: number[]) => void;
  /** Live feedback from the engine for the current value. */
  summary: {
    supplyMinutes: number; // sum of value
    demandMinutes: number; // what the home needs at full cadence
    coverage: number; // 0–1
  };
  /** When set, the panel is read-only with a Pro upsell overlay. */
  locked?: boolean;
  saving?: boolean;
}

function normalizeWeekArray(input: number[]): number[] {
  return Array.from({ length: 7 }, (_, i) => {
    const raw = input[i] ?? 0;
    return Math.max(0, Math.min(MAX_DAY_MINUTES, raw));
  });
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function formatWeeklyTotal(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h} h ${m} min this week`;
}

export function YourWeek({
  value,
  onChange,
  summary,
  locked = false,
  saving = false,
}: YourWeekProps) {
  const normalizedValue = React.useMemo(() => normalizeWeekArray(value), [value]);

  // Baseline snapshot captured when the panel opens (and updated when a save completes)
  const [baseline, setBaseline] = React.useState<number[]>(() => normalizedValue);
  const prevSavingRef = React.useRef<boolean>(saving);

  React.useEffect(() => {
    // When `saving` transitions from true -> false, treat current value as the new saved baseline
    if (prevSavingRef.current && !saving) {
      setBaseline(normalizedValue);
    }
    prevSavingRef.current = saving;
  }, [saving, normalizedValue]);

  const isDirty = !arraysEqual(normalizedValue, baseline);
  const isDisabled = locked || saving;

  function handleDayChange(dayIndex: number, nextMinutes: number) {
    if (isDisabled) return;
    const next = [...normalizedValue];
    next[dayIndex] = Math.max(0, Math.min(MAX_DAY_MINUTES, nextMinutes));
    onChange(next);
  }

  function handleCopyMondayToWeekdays() {
    if (isDisabled) return;
    const mondayMinutes = normalizedValue[0] ?? 0;
    const next = [...normalizedValue];
    // Copy Monday (0) to Tue (1), Wed (2), Thu (3), Fri (4) only
    for (let i = 1; i <= 4; i++) {
      next[i] = mondayMinutes;
    }
    onChange(next);
  }

  function handleResetDefaults() {
    if (isDisabled || !isDirty) return;
    onChange([...baseline]);
  }

  const weeklyTotalCopy = formatWeeklyTotal(summary.supplyMinutes);

  return (
    <Card className="relative overflow-hidden rounded-2xl border bg-surface p-5 sm:p-7 shadow-sm">
      <div
        aria-hidden={locked}
        className={cn(
          'space-y-6 transition-opacity motion-reduce:transition-none',
          locked && 'opacity-45 pointer-events-none select-none',
        )}
      >
        {/* 1. Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
              Your week
            </h2>
            <p className="text-sm text-ink-muted">
              Tell us how much time each day really has. We&apos;ll fit the plan to it.
            </p>
          </div>

          <CoverageReadout summary={summary} />
        </div>

        <Separator />

        {/* 2. Seven day rows (Mon → Sun) */}
        <div className="space-y-1.5">
          {DAYS_MONDAY_FIRST.map((day) => {
            const dayMinutes = normalizedValue[day.index] ?? 0;
            return (
              <DayRow
                key={day.index}
                day={day}
                minutes={dayMinutes}
                onChange={(mins) => handleDayChange(day.index, mins)}
                disabled={isDisabled}
                onCopyToWeekdays={
                  day.index === 0 ? handleCopyMondayToWeekdays : undefined
                }
                weeklyTotalCopy={
                  day.index === 6 ? weeklyTotalCopy : undefined
                }
              />
            );
          })}
        </div>

        <Separator />

        {/* 4. Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <Button
            type="submit"
            disabled={!isDirty || isDisabled}
            aria-busy={saving}
            className="w-full sm:w-auto"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save my week
          </Button>

          <button
            type="button"
            disabled={!isDirty || isDisabled}
            onClick={handleResetDefaults}
            className={cn(
              'text-xs font-medium text-ink-muted hover:text-ink underline-offset-4 hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm py-1',
              (!isDirty || isDisabled) && 'opacity-40 pointer-events-none',
            )}
          >
            Reset to defaults
          </button>
        </div>
      </div>

      {/* 5. Locked state overlay (locked = true) */}
      {locked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/65 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-md space-y-4">
            <div className="mx-auto inline-flex items-center justify-center w-10 h-10 rounded-full bg-surface-sage/70 text-ink">
              <Lock className="w-4 h-4" />
            </div>
            <p className="text-sm font-medium text-ink leading-relaxed">
              Set your real week with Pro — the plan will fit each day exactly.
            </p>
            <Button asChild size="default" className="w-full">
              <Link href="/pricing">Upgrade</Link>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
