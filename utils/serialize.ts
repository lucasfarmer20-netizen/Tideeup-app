/**
 * WeekPlan serialization helpers.
 *
 * The engine returns Date objects in WeekPlan.weekOf and each DayPlan.date.
 * These must be converted to ISO strings before storing as JSON (Supabase JSONB,
 * sessionStorage, API responses) and restored when reading back.
 */

import type { DayPlan, WeekPlan } from '@/lib/engine/types.js';

// ─── Serialized shapes ────────────────────────────────────────────────────────

export type SerializedDayPlan = Omit<DayPlan, 'date'> & { date: string };

export type SerializedWeekPlan = Omit<WeekPlan, 'weekOf' | 'days'> & {
  weekOf: string;
  days: SerializedDayPlan[];
};

// ─── Serialize ────────────────────────────────────────────────────────────────

export function serializeWeekPlan(plan: WeekPlan): SerializedWeekPlan {
  return {
    ...plan,
    weekOf: plan.weekOf.toISOString(),
    days: plan.days.map((day) => ({
      ...day,
      date: day.date.toISOString(),
    })),
  };
}

// ─── Deserialize ──────────────────────────────────────────────────────────────

export function deserializeWeekPlan(serialized: SerializedWeekPlan): WeekPlan {
  return {
    ...serialized,
    weekOf: new Date(serialized.weekOf),
    days: serialized.days.map((day) => ({
      ...day,
      date: new Date(day.date),
    })),
  };
}

/**
 * Safe parse: returns null instead of throwing if the input is malformed.
 */
export function safeDeserializeWeekPlan(raw: unknown): WeekPlan | null {
  try {
    return deserializeWeekPlan(raw as SerializedWeekPlan);
  } catch {
    return null;
  }
}
