'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import type {
  FlooringType,
  HomeSize,
  HomeType,
  PetType,
  TimePreference,
} from '@/lib/engine/types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizState {
  step: number;
  // Step 1
  homeSize: HomeSize | null;
  // Step 2
  homeType: HomeType | null;
  flooringTypes: FlooringType[];
  // Step 3
  householdCount: number;
  kids: boolean;
  petTypes: PetType[];
  // Step 4
  timePreference: TimePreference | null;
}

export interface UseQuizReturn {
  state: QuizState;
  set: <K extends keyof QuizState>(key: K, value: QuizState[K]) => void;
  advance: () => void;
  back: () => void;
  canAdvance: boolean;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

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

function parseHouseholdCount(s: string | null): number {
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= 6 ? n : 2;
}

const VALID_PET_TYPES: PetType[] = [
  'cat-1-2', 'cat-3-plus', 'small-dog-1-2',
  'large-dog-1-2', 'large-dog-3-plus', 'small-animals', 'other',
];
function parsePetTypes(s: string | null): PetType[] {
  if (!s) return [];
  return s.split(',').filter((v): v is PetType => VALID_PET_TYPES.includes(v as PetType));
}

function parseTimePreference(s: string | null): TimePreference | null {
  if (s === 'quick' || s === 'steady' || s === 'thorough' || s === 'batch') return s;
  return null;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function canAdvanceFrom(state: QuizState): boolean {
  if (state.step === 1) return state.homeSize !== null;
  if (state.step === 2) return state.homeType !== null && state.flooringTypes.length > 0;
  if (state.step === 3) return true; // count always defaults, pets optional
  if (state.step === 4) return state.timePreference !== null;
  if (state.step === 5) {
    return (
      state.homeSize !== null &&
      state.homeType !== null &&
      state.flooringTypes.length > 0 &&
      state.householdCount >= 1 &&
      state.timePreference !== null
    );
  }
  return false;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useQuiz(): UseQuizReturn {
  const router = useRouter();
  const params = useSearchParams();

  const state: QuizState = {
    step:           parseStep(params.get('step')),
    homeSize:       parseHomeSize(params.get('homeSize')),
    homeType:       parseHomeType(params.get('homeType')),
    flooringTypes:  parseFlooringTypes(params.get('flooringTypes')),
    householdCount: parseHouseholdCount(params.get('householdCount')),
    kids:           params.get('kids') === 'true',
    petTypes:       parsePetTypes(params.get('petTypes')),
    timePreference: parseTimePreference(params.get('timePreference')),
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

  const set = useCallback(
    <K extends keyof QuizState>(key: K, value: QuizState[K]) => {
      // Arrays are serialised as comma-separated strings (e.g. "hardwood,carpet")
      // Empty arrays become "" which parsers treat as [].
      router.push(buildUrl({ [key]: String(value) }), { scroll: false });
    },
    [router, buildUrl],
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

  return {
    state,
    set,
    advance,
    back,
    canAdvance: canAdvanceFrom(state),
  };
}
