/**
 * TideeUp Scheduling Engine — Main Pipeline
 *
 * Pipeline steps (in order):
 *  1. Normalise weekOf to Monday midnight UTC
 *  2. Detect season and current month
 *  3. Initialise day budgets — from the timePreference table, or the caller's
 *     per-day budgets (Pro "Your week" sliders); no-go days get 0
 *  4. Filter library by rotation state (paid tier)
 *  5. Score all eligible tasks (filtered by household profile + current month)
 *  6. Resolve each task's cadence into occurrences for this week
 *  7. Pressure: compare demand with supply and trim cadences toward their
 *     floors — protected tasks first-class, recently-done tasks slip first
 *  8. Place multi-occurrence tasks (stabilisers) spread across the week
 *  9. Place single-occurrence tasks on the day that best balances load and
 *     zone anchoring
 * 10. Collect unplaced tasks into spillover and report pressure
 *
 * The engine is pure: same input → same WeekPlan, every time.
 */

import type { DayPlan, PlannerInput, ScoredTask, Task, WeekPlan } from './types.js';
import { detectSeason } from './seasons.js';
import { scoreAndSort } from './scorer.js';
import { filterByRotation } from './rotator.js';
import { initDayPlans, canFit, placeTask } from './budgeter.js';
import {
  planOccurrences,
  trimToSupply,
  backfillOrder,
  trimmedReport,
  buildPressureReport,
} from './pressure.js';
import type { PlannedTask } from './pressure.js';
import { zoneAnchorMultiplier } from '../tasks/zones.js';
import { TASK_LIBRARY } from '../tasks/library.js';

// Monthly tasks lean toward the weekend, where fatigue thresholds are higher.
const MONTHLY_WEEKEND_BONUS = 1.3;
// Spillover shows only the highest-scored unplaced tasks.
const MAX_SPILLOVER = 10;

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Normalises any date to the Monday 00:00:00 UTC of its ISO week. */
function toMondayMidnightUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/** Share of a day's budget still unfilled, 0–1. Days with no budget are -1. */
function remainingRatio(day: DayPlan): number {
  if (day.budget <= 0) return -1;
  return (day.budget - day.totalMinutes) / day.budget;
}

function isWeekend(day: DayPlan): boolean {
  return day.dayOfWeek === 0 || day.dayOfWeek === 6;
}

/** Circular adjacency on a 7-slot week (index into `days`). */
function adjacent(a: number, b: number): boolean {
  const d = Math.abs(a - b);
  return d === 1 || d === 6;
}

// ─── Placement ────────────────────────────────────────────────────────────────

/**
 * Places a task that happens several times this week. Occurrences are spread:
 * each pick takes the fitting day with the most remaining budget, avoiding days
 * adjacent to an earlier pick while a non-adjacent day exists. Returns the
 * number of occurrences actually placed.
 */
function placeSpread(days: DayPlan[], p: PlannedTask): number {
  const chosen: number[] = [];
  const wanted = p.occurrences;

  while (chosen.length < wanted) {
    let bestIdx = -1;
    let bestKey = -Infinity;
    let bestIsAdjacent = true;

    for (let i = 0; i < days.length; i++) {
      const day = days[i]!;
      if (chosen.includes(i)) continue;
      if (!canFit(day, p.scored)) continue;
      const adj = chosen.some((c) => adjacent(c, i));
      const key = remainingRatio(day);
      // Prefer non-adjacent; within that, most remaining budget.
      if (
        (bestIsAdjacent && !adj) ||
        (bestIsAdjacent === adj && key > bestKey)
      ) {
        bestIdx = i;
        bestKey = key;
        bestIsAdjacent = adj;
      }
    }

    if (bestIdx === -1) break;
    placeTask(days[bestIdx]!, p.scored);
    chosen.push(bestIdx);
  }
  return chosen.length;
}

/**
 * Places a once-this-week task on the day that best balances remaining budget
 * against zone anchoring (and the weekend, for monthly tasks). Returns true if
 * it was placed.
 */
function placeSingle(days: DayPlan[], s: ScoredTask): boolean {
  let bestIdx = -1;
  let bestKey = -Infinity;

  for (let i = 0; i < days.length; i++) {
    const day = days[i]!;
    if (!canFit(day, s)) continue;
    let key = remainingRatio(day) * zoneAnchorMultiplier(s.task.zone, day.dayOfWeek);
    if (s.task.frequency === 'monthly' && isWeekend(day)) key *= MONTHLY_WEEKEND_BONUS;
    if (key > bestKey) {
      bestKey = key;
      bestIdx = i;
    }
  }

  if (bestIdx === -1) return false;
  placeTask(days[bestIdx]!, s);
  return true;
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export function generateWeekPlan(input: PlannerInput): WeekPlan {
  // ── Step 1: Normalise weekOf ───────────────────────────────────────────────
  const weekOf = toMondayMidnightUTC(input.weekOf);

  // ── Step 2: Detect season and current month ───────────────────────────────
  const season = input.seasonOverride ?? detectSeason(weekOf);
  const currentMonth = weekOf.getUTCMonth() + 1; // 1–12

  // ── Step 3: Initialise day budgets ────────────────────────────────────────
  const days = initDayPlans(weekOf, input.timePreference);

  if (input.dayBudgets && input.dayBudgets.length === 7) {
    for (let i = 0; i < 7; i++) {
      days[i]!.budget = Math.max(0, Math.round(input.dayBudgets[i] ?? 0));
    }
  }

  if (input.noGoDays && input.noGoDays.length > 0) {
    const noGoSet = new Set(input.noGoDays);
    for (const day of days) {
      if (noGoSet.has(day.dayOfWeek)) day.budget = 0;
    }
  }

  const supplyMinutes = days.reduce((sum, d) => sum + d.budget, 0);

  // ── Step 4: Rotation filter ───────────────────────────────────────────────
  const taskLibrary =
    input.customTasks && input.customTasks.length > 0
      ? [...TASK_LIBRARY, ...input.customTasks]
      : TASK_LIBRARY;
  const eligible = filterByRotation(taskLibrary, weekOf, input.rotationState);

  // ── Step 5: Score all eligible tasks ─────────────────────────────────────
  const scored = scoreAndSort(eligible, input, season, currentMonth);

  // ── Step 6: Cadence → occurrences this week ───────────────────────────────
  const planned = planOccurrences(scored, weekOf, input.rotationState, input.priorities);

  // ── Step 7: Pressure — trim toward floors until demand fits supply ────────
  trimToSupply(planned, supplyMinutes);

  // ── Step 8: Multi-occurrence tasks, protected first, then by score ────────
  // Protected tasks go first, most consequential first (chaosImpact), so when a
  // day genuinely can't hold the whole floor, dishes beats making beds.
  const multi = planned
    .filter((p) => p.occurrences >= 2)
    .sort((a, b) => {
      if (a.protected !== b.protected) return a.protected ? -1 : 1;
      if (a.protected && a.scored.task.chaosImpact !== b.scored.task.chaosImpact) {
        return b.scored.task.chaosImpact - a.scored.task.chaosImpact;
      }
      if (a.urgency !== b.urgency) return b.urgency - a.urgency;
      return b.scored.score - a.scored.score;
    });

  const placedOccurrences = new Map<string, number>();
  for (const p of multi) {
    placedOccurrences.set(p.scored.task.id, placeSpread(days, p));
  }

  // ── Step 9: Single-occurrence tasks — overdue first, then by score ───────
  const single = planned
    .filter((p) => p.occurrences === 1)
    .sort((a, b) => {
      if (a.urgency !== b.urgency) return b.urgency - a.urgency;
      return b.scored.score - a.scored.score;
    });

  for (const p of single) {
    placedOccurrences.set(p.scored.task.id, placeSingle(days, p.scored) ? 1 : 0);
  }

  // ── Step 9b: Backfill — give slack back to what was trimmed ──────────────
  // Trimming runs before packing and aims below full supply, so some minutes
  // are usually left. Restore the most valuable trimmed occurrences into
  // whatever gaps remain, one occurrence at a time, until nothing more fits.
  let restored = true;
  while (restored) {
    restored = false;
    for (const p of backfillOrder(planned)) {
      const already = placedOccurrences.get(p.scored.task.id) ?? 0;
      const one: PlannedTask = { ...p, occurrences: 1 };
      // A multi-occurrence task shouldn't land twice on one day.
      const usedDays = new Set(
        days.flatMap((d, i) => (d.tasks.some((t) => t.task.id === p.scored.task.id) ? [i] : [])),
      );
      const free = days.map((d, i) => (usedDays.has(i) ? { ...d, budget: 0 } : d));
      let placedIdx = -1;
      for (let i = 0; i < free.length; i++) {
        const day = free[i]!;
        if (!canFit(day, one.scored)) continue;
        const key = remainingRatio(day) * zoneAnchorMultiplier(p.scored.task.zone, day.dayOfWeek);
        if (placedIdx === -1 || key > remainingRatio(free[placedIdx]!) * zoneAnchorMultiplier(p.scored.task.zone, free[placedIdx]!.dayOfWeek)) {
          placedIdx = i;
        }
      }
      if (placedIdx === -1) continue;
      placeTask(days[placedIdx]!, p.scored);
      p.occurrences += 1;
      placedOccurrences.set(p.scored.task.id, already + 1);
      restored = true;
      break; // re-rank after every restore
    }
  }
  const trimmedFinal = trimmedReport(planned);

  // ── Step 10: Spillover + pressure report ──────────────────────────────────
  // Spillover = non-daily tasks the home needed this week that got no day:
  // trimmed to zero by pressure, or wanted but not placeable.
  const spillover: Task[] = planned
    .filter((p) => (placedOccurrences.get(p.scored.task.id) ?? 0) === 0)
    .filter((p) => p.scored.task.frequency !== 'daily')
    .sort((a, b) => {
      if (a.urgency !== b.urgency) return b.urgency - a.urgency;
      return b.scored.score - a.scored.score;
    })
    .map((p) => p.scored.task)
    .slice(0, MAX_SPILLOVER);

  const totalScheduled = days.reduce((sum, d) => sum + d.tasks.length, 0);
  const totalMinutes   = days.reduce((sum, d) => sum + d.totalMinutes, 0);

  return {
    weekOf,
    days,
    spillover,
    metadata: {
      totalTasksScheduled: totalScheduled,
      totalMinutesPlanned: totalMinutes,
      season,
      pressure: buildPressureReport(planned, supplyMinutes, totalMinutes, trimmedFinal),
    },
  };
}

// ─── Convenience re-exports ───────────────────────────────────────────────────
export type { WeekPlan, DayPlan, PlannerInput } from './types.js';
