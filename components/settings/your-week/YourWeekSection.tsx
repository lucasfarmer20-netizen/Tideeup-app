'use client';

import { useCallback, useMemo, useState } from 'react';
import { YourWeek } from './YourWeek';
import { generateWeekPlan } from '@/lib/engine/planner.js';
import { getDayBudget } from '@/lib/engine/budgeter.js';
import type {
  FlooringType,
  HomeSize,
  HomeType,
  PetType,
  PlannerInput,
  TimePreference,
} from '@/lib/engine/types.js';

/** The subset of the household row this section needs. */
export interface YourWeekHousehold {
  home_size: string;
  home_type?: string | null;
  household_count: number;
  pets: boolean;
  pet_types?: string[] | null;
  kids: boolean;
  time_preference: string;
  flooring_types?: string[] | null;
  day_budgets?: number[] | null;
}

interface Props {
  household: YourWeekHousehold | null;
  isPaid: boolean;
  onSaved: (dayBudgets: number[]) => void;
}

// Monday-first dayOfWeek sequence used by the engine's DayPlan ordering.
const DOW_MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

function normalisePref(raw: string): TimePreference {
  if (raw === 'quick' || raw === 'steady' || raw === 'thorough' || raw === 'batch') return raw;
  if (raw === '10') return 'quick';
  if (raw === '30' || raw === 'BATCH') return 'thorough';
  return 'steady';
}

/** What the time-preference table would give — the sliders' starting point. */
function defaultsFor(pref: TimePreference): number[] {
  return DOW_MONDAY_FIRST.map((dow) => getDayBudget(dow, pref));
}

function toPlannerBase(h: YourWeekHousehold): Omit<PlannerInput, 'weekOf' | 'dayBudgets'> {
  const storedPets = Array.isArray(h.pet_types) ? (h.pet_types as PetType[]) : null;
  return {
    homeSize: (h.home_size as HomeSize) ?? 'M',
    homeType: (h.home_type as HomeType | null | undefined) ?? 'single-family',
    householdCount: h.household_count ?? 2,
    petTypes: storedPets ?? (h.pets ? ['cat-1-2'] : []),
    kids: Boolean(h.kids),
    flooringTypes: Array.isArray(h.flooring_types) ? (h.flooring_types as FlooringType[]) : ['mixed'],
    timePreference: normalisePref(h.time_preference),
  };
}

export function YourWeekSection({ household, isPaid, onSaved }: Props) {
  const pref = normalisePref(household?.time_preference ?? 'steady');
  const initial = useMemo<number[]>(() => {
    const stored = household?.day_budgets;
    return Array.isArray(stored) && stored.length === 7 ? [...stored] : defaultsFor(pref);
  }, [household?.day_budgets, pref]);

  const [value, setValue] = useState<number[]>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The engine is pure and synchronous, so the coverage readout can be computed
  // right here on every change — no round-trip, no debounce needed.
  const summary = useMemo(() => {
    if (!household) return { supplyMinutes: 0, demandMinutes: 0, coverage: 1 };
    const plan = generateWeekPlan({ ...toPlannerBase(household), weekOf: new Date(), dayBudgets: value });
    const p = plan.metadata.pressure;
    return { supplyMinutes: p.supplyMinutes, demandMinutes: p.demandMinutes, coverage: p.coverage };
  }, [household, value]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!isPaid) return;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/settings/household', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dayBudgets: value }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(body?.message ?? 'Could not save your week.');
        }
        onSaved(value);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save your week.');
      } finally {
        setSaving(false);
      }
    },
    [isPaid, value, onSaved],
  );

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2">
      <YourWeek value={value} onChange={setValue} summary={summary} locked={!isPaid} saving={saving} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
