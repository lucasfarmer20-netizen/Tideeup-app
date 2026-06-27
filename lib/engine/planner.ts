/**
 * TideeUp Scheduling Engine — Main Pipeline
 *
 * Pipeline steps (in order):
 *  1. Normalise weekOf to Monday midnight UTC
 *  2. Detect season and current month
 *  3. Initialise day budgets (7 DayPlan objects)
 *  4. Filter library by rotation state (paid tier)
 *  5. Score all eligible tasks (filtered by household profile + current month)
 *  6. Separate daily stabilisers, weekly, monthly, and quick tasks
 *  7. Place daily stabilisers on every day — capped at 85% of day budget
 *     so weekly tasks always have room
 *  8. Apply zone-anchor score boost; allocate weekly tasks to best-fit days
 *  9. Assign monthly tasks to weekend days
 * 10. Fill remaining budget gaps with quick tasks
 * 11. Collect unplaced tasks into spillover
 */

import type { DayPlan, PlannerInput, ScoredTask, Task, WeekPlan } from './types.js';
import { detectSeason } from './seasons.js';
import { scoreAndSort } from './scorer.js';
import { filterByRotation } from './rotator.js';
import {
  initDayPlans,
  canFit,
  placeTask,
  findBestDay,
  findBestWeekendDay,
} from './budgeter.js';
import { zoneAnchorMultiplier } from '../tasks/zones.js';
import { TASK_LIBRARY } from '../tasks/library.js';

// Daily stabilisers are capped at this fraction of the day budget.
// 0.85 lets the most important 4-7 habits always appear without fully
// crowding out weekly tasks on days with tight budgets.
const STABILIZER_BUDGET_RATIO = 0.85;

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Normalises any date to the Monday 00:00:00 UTC of its ISO week.
 */
function toMondayMidnightUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/**
 * Applies zone-anchor bonus to a scored task for a specific day.
 * Returns a new ScoredTask with an adjusted score (score only — minutes unchanged).
 */
function withZoneBoost(scored: ScoredTask, dayOfWeek: number): ScoredTask {
  const multiplier = zoneAnchorMultiplier(scored.task.zone, dayOfWeek);
  return {
    ...scored,
    score: scored.task.frequency === 'daily' ? scored.score : scored.score * multiplier,
  };
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

  // Zero out no-go days so canFit() never places tasks on them
  if (input.noGoDays && input.noGoDays.length > 0) {
    const noGoSet = new Set(input.noGoDays);
    for (const day of days) {
      if (noGoSet.has(day.dayOfWeek)) {
        day.budget = 0;
      }
    }
  }

  // ── Step 4: Rotation filter ───────────────────────────────────────────────
  const taskLibrary =
    input.customTasks && input.customTasks.length > 0
      ? [...TASK_LIBRARY, ...input.customTasks]
      : TASK_LIBRARY;
  const eligible = filterByRotation(taskLibrary, weekOf, input.rotationState);

  // ── Step 5: Score all eligible tasks ─────────────────────────────────────
  // scoreAndSort applies household-profile filters (petTypes, flooringTypes,
  // homeType, seasonalMonths) before scoring.
  const scored = scoreAndSort(eligible, input, season, currentMonth);

  // ── Step 6: Partition tasks by frequency ─────────────────────────────────
  const dailyStabilisers = scored.filter((s) => s.task.frequency === 'daily');
  const weeklyTasks      = scored.filter((s) => s.task.frequency === 'weekly');
  const monthlyTasks     = scored.filter((s) => s.task.frequency === 'monthly');

  // Quick tasks = non-daily tasks that fit in ≤10 min — used to fill gaps.
  const QUICK_THRESHOLD = 10;
  const quickPool = scored.filter(
    (s) => s.task.frequency !== 'daily' && s.estimatedMinutes <= QUICK_THRESHOLD,
  );

  const placed = new Set<string>();

  // ── Step 7: Place daily stabilisers — 85% budget cap ────────────────────
  // Cap stabilisers at STABILIZER_BUDGET_RATIO of each day's budget so that
  // weekly tasks always have room. Tasks are placed in priority order (scored
  // highest-first), so the most important ones always make it in.
  for (const day of days) {
    const stabilizerBudget = Math.floor(day.budget * STABILIZER_BUDGET_RATIO);
    // Temporarily narrow the budget so canFit() enforces the cap
    const fullBudget = day.budget;
    day.budget = stabilizerBudget;
    for (const s of dailyStabilisers) {
      if (canFit(day, s)) {
        placeTask(day, s);
        // Daily tasks are NOT added to `placed` — they repeat every day.
      }
    }
    day.budget = fullBudget;
  }

  // ── Step 8: Allocate weekly tasks with zone-anchor boosting ───────────────
  for (const s of weeklyTasks) {
    if (placed.has(s.task.id)) continue;

    let bestDayIdx = -1;
    let bestAdjustedScore = -Infinity;

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      if (day === undefined) continue;
      if (!canFit(day, s)) continue;
      const adjusted = withZoneBoost(s, day.dayOfWeek).score;
      if (adjusted > bestAdjustedScore) {
        bestAdjustedScore = adjusted;
        bestDayIdx = i;
      }
    }

    if (bestDayIdx !== -1) {
      placeTask(days[bestDayIdx]!, s);
      placed.add(s.task.id);
    }
  }

  // ── Step 9: Assign monthly tasks to weekends ──────────────────────────────
  for (const s of monthlyTasks) {
    if (placed.has(s.task.id)) continue;
    const idx = findBestWeekendDay(days, s);
    if (idx !== -1) {
      placeTask(days[idx]!, s);
      placed.add(s.task.id);
    } else {
      const fallback = findBestDay(days, s);
      if (fallback !== -1) {
        placeTask(days[fallback]!, s);
        placed.add(s.task.id);
      }
    }
  }

  // ── Step 10: Fill gaps with quick tasks ───────────────────────────────────
  for (const day of days) {
    for (const quick of quickPool) {
      if (placed.has(quick.task.id)) continue;
      if (canFit(day, quick)) {
        placeTask(day, quick);
        placed.add(quick.task.id);
      }
    }
  }

  // ── Step 11: Collect spillover ────────────────────────────────────────────
  // Cap spillover at 10: show the highest-scored unplaced tasks only.
  // (Tasks are already sorted by score desc, so slice keeps the best ones.)
  const MAX_SPILLOVER = 10;
  const allNonDaily = [...weeklyTasks, ...monthlyTasks];
  const spillover: Task[] = allNonDaily
    .filter((s) => !placed.has(s.task.id))
    .map((s) => s.task)
    .slice(0, MAX_SPILLOVER);

  // ── Assemble WeekPlan ─────────────────────────────────────────────────────
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
    },
  };
}

// ─── Convenience re-exports ───────────────────────────────────────────────────
export type { WeekPlan, DayPlan, PlannerInput } from './types.js';
