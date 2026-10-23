import type { DayPlan, ScoredTask, TimePreference } from './types.js';

// ─── Day budget tables (minutes) ─────────────────────────────────────────────
//
// Budgets are calibrated to what users actually said they can spend:
//   quick    → 15-20 min/day   (stabilisers only)
//   steady   → 30-40 min/day   (stabilisers + 2-3 weekly tasks)
//   thorough → 50-60 min/day   (full coverage)
//   batch    → minimal weekdays, ~2 big weekend sessions
//
// Weekends are given modest extra headroom (people have more flexibility),
// but NOT the 3× inflation of the old model that caused the plan-bloat bug.
//
// dayOfWeek: 0=Sun, 1–5=Mon–Fri, 6=Sat

const BUDGETS: Record<TimePreference, Record<'weekday' | 'saturday' | 'sunday', number>> = {
  quick:    { weekday: 20,  saturday: 35,  sunday: 28  },
  steady:   { weekday: 35,  saturday: 65,  sunday: 50  },
  thorough: { weekday: 55,  saturday: 105, sunday: 80  },
  batch:    { weekday: 15,  saturday: 130, sunday: 105 },
};

function dayKey(dayOfWeek: number): 'weekday' | 'saturday' | 'sunday' {
  if (dayOfWeek === 6) return 'saturday';
  if (dayOfWeek === 0) return 'sunday';
  return 'weekday';
}

/**
 * Returns the minute budget for a specific day and time preference.
 */
export function getDayBudget(dayOfWeek: number, pref: TimePreference): number {
  return BUDGETS[pref][dayKey(dayOfWeek)];
}

// ─── Fatigue thresholds ───────────────────────────────────────────────────────
//
// Maximum cumulative fatigueCost allowed per day.
// Weekends allow more fatigue (BATCH-style deep cleans).

const FATIGUE_THRESHOLD = {
  weekday:  2.5,
  saturday: 4.5,
  sunday:   3.5,
} as const;

export function getFatigueThreshold(dayOfWeek: number): number {
  return FATIGUE_THRESHOLD[dayKey(dayOfWeek)];
}

// ─── Day plan initialisation ──────────────────────────────────────────────────

/**
 * Builds an empty DayPlan for each day of the target week (Mon–Sun).
 * `weekOf` should be the Monday midnight UTC of the target week.
 */
export function initDayPlans(weekOf: Date, pref: TimePreference): DayPlan[] {
  const days: DayPlan[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekOf);
    date.setUTCDate(weekOf.getUTCDate() + i);
    const dayOfWeek = date.getUTCDay();
    days.push({
      date,
      dayOfWeek,
      tasks: [],
      totalMinutes: 0,
      budget: getDayBudget(dayOfWeek, pref),
      fatigue: 0,
    });
  }
  return days;
}

// ─── Allocation helpers ───────────────────────────────────────────────────────

/**
 * Returns true if a scored task can be placed on a day without
 * exceeding either the time budget or the fatigue threshold.
 */
export function canFit(day: DayPlan, scored: ScoredTask): boolean {
  const budgetOk = day.totalMinutes + scored.estimatedMinutes <= day.budget;
  const fatigueOk =
    day.fatigue + scored.task.fatigueCost <= getFatigueThreshold(day.dayOfWeek);
  return budgetOk && fatigueOk;
}

/**
 * Mutates a DayPlan in-place by placing a scored task.
 */
export function placeTask(day: DayPlan, scored: ScoredTask): void {
  day.tasks.push({
    task: scored.task,
    estimatedMinutes: scored.estimatedMinutes,
    zone: scored.task.zone,
  });
  day.totalMinutes += scored.estimatedMinutes;
  day.fatigue += scored.task.fatigueCost;
}

/**
 * Finds the best day to place a scored task from a list of candidate days.
 *
 * Selection criteria (in order):
 * 1. The day must have room (canFit).
 * 2. Among fitting days, prefer those with more remaining budget
 *    (encourages even distribution).
 *
 * Returns the index into `days`, or -1 if no day can accommodate it.
 */
export function findBestDay(days: DayPlan[], scored: ScoredTask): number {
  let bestIdx = -1;
  let bestRemaining = -1;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (day === undefined) continue;
    if (!canFit(day, scored)) continue;
    const remaining = day.budget - day.totalMinutes;
    if (remaining > bestRemaining) {
      bestRemaining = remaining;
      bestIdx = i;
    }
  }

  return bestIdx;
}

/**
 * Variant of findBestDay that restricts candidates to weekend days (Sat/Sun).
 * Used for monthly task placement.
 */
export function findBestWeekendDay(days: DayPlan[], scored: ScoredTask): number {
  const weekendDays = days
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.dayOfWeek === 0 || d.dayOfWeek === 6);

  let bestIdx = -1;
  let bestRemaining = -1;

  for (const { d, i } of weekendDays) {
    if (!canFit(d, scored)) continue;
    const remaining = d.budget - d.totalMinutes;
    if (remaining > bestRemaining) {
      bestRemaining = remaining;
      bestIdx = i;
    }
  }

  return bestIdx;
}
