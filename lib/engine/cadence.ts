/**
 * Cadence — how often each task should happen this week, and how far it may
 * be degraded when the household can't cover full demand.
 *
 * Pure functions, no I/O. Everything here is deterministic for a given
 * (task, weekOf, rotationState) so plans stay reproducible.
 */

import type { Cadence, Priority, RotationState, Task, Zone } from './types.js';

// ─── Defaults by frequency class ─────────────────────────────────────────────

const DEFAULT_CADENCE: Record<Task['frequency'], Cadence> = {
  daily:   { target: 7,    min: 7 },
  weekly:  { target: 1,    min: 0 },
  monthly: { target: 0.25, min: 0 },
};

/** Explicit cadence if the library set one, else the frequency default. */
export function resolveCadence(task: Task): Cadence {
  return task.cadence ?? DEFAULT_CADENCE[task.frequency];
}

/** Days between ideal occurrences — used for urgency. */
export function intervalDays(task: Task): number {
  const { target } = resolveCadence(task);
  if (target <= 0) return Infinity;
  return 7 / target;
}

// ─── Monthly spread ───────────────────────────────────────────────────────────
//
// Without rotation memory every monthly task would be "due" every week and the
// free tier's demand would be absurd. Instead each monthly task is assigned a
// fixed week-of-cycle from a hash of its id, so roughly a quarter of the
// monthly library comes due each week, the same quarter every time for the
// same week (deterministic).

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** 0-based ISO-ish week index since the Unix epoch (Monday-aligned). */
export function weekIndex(weekOf: Date): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  // 1970-01-05 was a Monday.
  const epochMonday = Date.UTC(1970, 0, 5);
  return Math.floor((weekOf.getTime() - epochMonday) / msPerWeek);
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * How many times this task should ideally happen *this* week.
 *
 * - target ≥ 1 → that many occurrences (rounded)
 * - target < 1 (monthly) → 1 in its assigned week of a 1/target-week cycle,
 *   or 1 if rotation memory says it is overdue, else 0
 */
export function occurrencesThisWeek(
  task: Task,
  weekOf: Date,
  rotationState: RotationState | undefined,
): number {
  const { target } = resolveCadence(task);
  if (target >= 1) return Math.round(target);
  if (target <= 0) return 0;

  const cycleWeeks = Math.round(1 / target); // 0.25 → 4
  const lastDoneStr = rotationState?.lastDone[task.id];
  if (lastDoneStr) {
    const lastDone = new Date(lastDoneStr);
    if (!isNaN(lastDone.getTime())) {
      const since = daysBetween(lastDone, weekOf);
      // Overdue by more than a week past its interval → due now.
      if (since >= cycleWeeks * 7 + 7) return 1;
      // Done recently → not due, regardless of the hash slot.
      if (since < (cycleWeeks - 1) * 7) return 0;
    }
  }
  return hashId(task.id) % cycleWeeks === weekIndex(weekOf) % cycleWeeks ? 1 : 0;
}

/** Minimum occurrences this week that degradation may not go below. */
export function minOccurrencesThisWeek(task: Task, ideal: number): number {
  const { target, min } = resolveCadence(task);
  if (ideal === 0) return 0;
  if (target >= 1) return Math.min(ideal, Math.max(0, Math.round(min)));
  // Monthly: min is 0 or "keep it" (any positive value)
  return min > 0 ? ideal : 0;
}

// ─── Urgency ─────────────────────────────────────────────────────────────────
//
// urgency = days since last done / ideal interval.
//   < 1  recently done, can slip
//   = 1  right on schedule (also the neutral value when nothing is known)
//   > 1  overdue, protect
// Only paid users have rotation state, so the free tier gets 1.0 for everything
// and degradation falls back to value density.

export function urgency(
  task: Task,
  weekOf: Date,
  rotationState: RotationState | undefined,
): number {
  const lastDoneStr = rotationState?.lastDone[task.id];
  if (!lastDoneStr) return 1;
  const lastDone = new Date(lastDoneStr);
  if (isNaN(lastDone.getTime())) return 1;
  const interval = intervalDays(task);
  if (!isFinite(interval) || interval <= 0) return 1;
  const since = daysBetween(lastDone, weekOf);
  return Math.round((since / interval) * 100) / 100;
}

// ─── Protected set ───────────────────────────────────────────────────────────
//
// Tasks that never degrade below their target. Two sources:
//   1. The library's hard floor — tagged `protected` (dishes, pickup, litter…)
//   2. The household's stated priorities from the quiz.

const PRIORITY_ZONES: Partial<Record<Priority, Zone[]>> = {
  'kitchen-reset': ['kitchen'],
  'bathrooms':     ['bathroom'],
};

const PRIORITY_TAGS: Partial<Record<Priority, string[]>> = {
  'floors':   ['floors'],
  'clutter':  ['clutter'],
  'pet-mess': ['pet'],
};

export function isProtected(task: Task, priorities: Priority[] | undefined): boolean {
  if (task.tags.includes('protected')) return true;
  if (!priorities || priorities.length === 0) return false;
  for (const p of priorities) {
    const zones = PRIORITY_ZONES[p];
    if (zones && zones.includes(task.zone) && task.frequency === 'daily') return true;
    const tags = PRIORITY_TAGS[p];
    if (tags && tags.some((t) => task.tags.includes(t))) return true;
  }
  return false;
}
