'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import type {
  FlooringType,
  HomeSize,
  HomeType,
  KidAges,
  PetType,
  Priority,
  TimeDistribution,
  TimePreference,
} from '@/lib/engine/types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizState {
  step: number;
  // Step 1 — home
  homeSize: HomeSize | null;
  bathrooms: number;            // 1–4 (4 = "4+")
  floors: 1 | 2;
  // Step 2 — details
  homeType: HomeType | null;
  flooringTypes: FlooringType[];
  // Step 3 — household
  adults: number;               // 1–6
  kidAges: KidAges;
  petTypes: PetType[];
  // Step 4 — time
  weeklyHours: number | null;   // 2 | 3.5 | 6 | 9
  distribution: TimeDistribution;
  // Step 5 — priorities (pick up to 2)
  priorities: Priority[];

  // ── Derived (kept so existing consumers keep working) ───────────────────
  /** adults + all kids, clamped to 1–6 */
  householdCount: number;
  /** any kids at all */
  kids: boolean;
  /** coarse preference derived from weeklyHours (for legacy storage/UI) */
  timePreference: TimePreference | null;
}

export interface UseQuizReturn {
  state: QuizState;
  set: <K extends keyof QuizState>(key: K, value: QuizState[K]) => void;
  setAndAdvance: <K extends keyof QuizState>(key: K, value: QuizState[K]) => void;
  advance: () => void;
  back: () => void;
  goToStep: (targetStep: number) => void;
  canAdvance: boolean;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;
export { TOTAL_STEPS };

function parseStep(s: string | null): number {
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= TOTAL_STEPS ? n : 1;
}

function parseHomeSize(s: string | null): HomeSize | null {
  if (s === 'S' || s === 'M' || s === 'L' || s === 'XL') return s;
  return null;
}

function parseHomeType(s: string | null): HomeType | null {
  if (
    s === 'apartment' ||
    s === 'townhouse' ||
    s === 'single-family' ||
    s === 'large-home'
  ) return s;
  return null;
}

const VALID_FLOORING: FlooringType[] = ['hardwood', 'carpet', 'tile', 'mixed'];
function parseFlooringTypes(s: string | null): FlooringType[] {
  if (!s) return [];
  return s.split(',').filter((v): v is FlooringType => VALID_FLOORING.includes(v as FlooringType));
}

function parseIntIn(s: string | null, min: number, max: number, fallback: number): number {
  const n = Number(s);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

function parseKidAges(s: string | null): KidAges {
  // Serialised as "under5,5to12,teen" counts, e.g. "1,2,0"
  const parts = (s ?? '').split(',').map((x) => Number(x));
  const pick = (i: number) => {
    const n = parts[i];
    return n !== undefined && Number.isInteger(n) && n >= 0 && n <= 8 ? n : 0;
  };
  return { under5: pick(0), age5to12: pick(1), teen: pick(2) };
}

export const WEEKLY_HOURS_OPTIONS = [2, 3.5, 6, 9] as const;
function parseWeeklyHours(s: string | null): number | null {
  const n = Number(s);
  return (WEEKLY_HOURS_OPTIONS as readonly number[]).includes(n) ? n : null;
}

function parseDistribution(s: string | null): TimeDistribution {
  if (s === 'weekends' || s === 'weekdays' || s === 'spread') return s;
  return 'spread';
}

const VALID_PRIORITIES: Priority[] = ['kitchen-reset', 'bathrooms', 'floors', 'clutter', 'pet-mess'];
function parsePriorities(s: string | null): Priority[] {
  if (!s) return [];
  return s.split(',').filter((v): v is Priority => VALID_PRIORITIES.includes(v as Priority)).slice(0, 2);
}

/** Coarse preference for legacy storage: hours/week → quick/steady/thorough. */
export function hoursToPreference(hours: number | null): TimePreference | null {
  if (hours === null) return null;
  if (hours <= 2.5) return 'quick';
  if (hours <= 4.5) return 'steady';
  return 'thorough';
}

const VALID_PET_TYPES: PetType[] = [
  'cat-1-2', 'cat-3-plus', 'small-dog-1-2',
  'large-dog-1-2', 'large-dog-3-plus', 'small-animals', 'other',
];
function parsePetTypes(s: string | null): PetType[] {
  if (!s) return [];
  return s.split(',').filter((v): v is PetType => VALID_PET_TYPES.includes(v as PetType));
}

// ─── Validation ───────────────────────────────────────────────────────────────

function canAdvanceFrom(state: QuizState): boolean {
  if (state.step === 1) return state.homeSize !== null;
  if (state.step === 2) return state.homeType !== null && state.flooringTypes.length > 0;
  if (state.step === 3) return state.adults >= 1; // pets and kids optional
  if (state.step === 4) return state.weeklyHours !== null;
  if (state.step === 5) return true; // priorities optional
  if (state.step === 6) {
    return (
      state.homeSize !== null &&
      state.homeType !== null &&
      state.flooringTypes.length > 0 &&
      state.adults >= 1 &&
      state.weeklyHours !== null
    );
  }
  return false;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useQuiz(): UseQuizReturn {
  const router = useRouter();
  const params = useSearchParams();

  const adults = parseIntIn(params.get('adults'), 1, 6, 2);
  const kidAges = parseKidAges(params.get('kidAges'));
  const totalKids = kidAges.under5 + kidAges.age5to12 + kidAges.teen;
  const weeklyHours = parseWeeklyHours(params.get('weeklyHours'));
  const floorsRaw = parseIntIn(params.get('floors'), 1, 2, 1);

  const state: QuizState = {
    step:           parseStep(params.get('step')),
    homeSize:       parseHomeSize(params.get('homeSize')),
    bathrooms:      parseIntIn(params.get('bathrooms'), 1, 4, 2),
    floors:         floorsRaw === 2 ? 2 : 1,
    homeType:       parseHomeType(params.get('homeType')),
    flooringTypes:  parseFlooringTypes(params.get('flooringTypes')),
    adults,
    kidAges,
    petTypes:       parsePetTypes(params.get('petTypes')),
    weeklyHours,
    distribution:   parseDistribution(params.get('distribution')),
    priorities:     parsePriorities(params.get('priorities')),
    // derived
    householdCount: Math.max(1, Math.min(6, adults + totalKids)),
    kids:           totalKids > 0,
    timePreference: hoursToPreference(weeklyHours),
  };

  const buildUrl = useCallback(
    (updates: Partial<Record<string, string>>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined) next.set(k, v);
      }
      return `/quiz?${next.toString()}`;
    },
    [params],
  );

  const serialise = (value: unknown): string => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const k = value as KidAges;
      return `${k.under5},${k.age5to12},${k.teen}`;
    }
    // Arrays are serialised as comma-separated strings (e.g. "hardwood,carpet")
    // Empty arrays become "" which parsers treat as [].
    return String(value);
  };

  const set = useCallback(
    <K extends keyof QuizState>(key: K, value: QuizState[K]) => {
      router.push(buildUrl({ [key]: serialise(value) }), { scroll: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, buildUrl],
  );

  const setAndAdvance = useCallback(
    <K extends keyof QuizState>(key: K, value: QuizState[K]) => {
      const nextStep = state.step < TOTAL_STEPS ? state.step + 1 : state.step;
      router.push(
        buildUrl({
          [key]: serialise(value),
          step: String(nextStep),
        }),
        { scroll: false },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, buildUrl, state.step],
  );

  const advance = useCallback(() => {
    if (state.step < TOTAL_STEPS) {
      router.push(buildUrl({ step: String(state.step + 1) }), { scroll: false });
    }
  }, [router, buildUrl, state.step]);

  const back = useCallback(() => {
    if (state.step > 1) {
      router.push(buildUrl({ step: String(state.step - 1) }), { scroll: false });
    }
  }, [router, buildUrl, state.step]);

  const goToStep = useCallback(
    (targetStep: number) => {
      if (targetStep >= 1 && targetStep <= TOTAL_STEPS) {
        router.push(buildUrl({ step: String(targetStep) }), { scroll: false });
      }
    },
    [router, buildUrl],
  );

  return {
    state,
    set,
    setAndAdvance,
    advance,
    back,
    goToStep,
    canAdvance: canAdvanceFrom(state),
  };
}
