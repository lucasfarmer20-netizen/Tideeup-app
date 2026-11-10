/** Pure deterministic planner. P2 separates day-specific upkeep from flexible
 * maintenance; every report is derived from actual placements. Stored historical
 * plans are never regenerated or reinterpreted on read. */
import type { PlannerInput, Task, WeekPlan, UnscheduledCustomTask } from './types.js';
import { detectSeason } from './seasons.js';
import { scoreAndSort } from './scorer.js';
import { filterByRotation } from './rotator.js';
import { initDayPlans } from './budgeter.js';
import { deriveDayBudgets } from './profile.js';
import { planOccurrences, buildPressureReport } from './pressure.js';
import { householdTasks } from './household-work.js';
import { allocateWork } from './allocation.js';

function toMondayMidnightUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + (d.getUTCDay() === 0 ? -6 : 1 - d.getUTCDay()));
  return d;
}

export function generateWeekPlan(input: PlannerInput): WeekPlan {
  const weekOf = toMondayMidnightUTC(input.weekOf);
  const season = input.seasonOverride ?? detectSeason(weekOf);
  const days = initDayPlans(weekOf, input.timePreference);
  const budgets = deriveDayBudgets(input);
  for (const [i, day] of days.entries()) {
    const requested = budgets[i] ?? day.budget;
    day.budget = Number.isFinite(requested) ? Math.max(0, Math.min(180, Math.round(requested))) : 0;
    if (input.noGoDays?.includes(day.dayOfWeek)) day.budget = 0;
  }
  const library = householdTasks(input);
  if (new Set(library.map(t => t.id)).size !== library.length) throw new RangeError('Task IDs must be unique');
  const eligible = filterByRotation(library, weekOf, input.rotationState);
  const scored = scoreAndSort(eligible, input, season, weekOf.getUTCMonth() + 1);
  const planned = planOccurrences(scored, weekOf, input.rotationState, input.priorities);
  const workload = allocateWork(days, planned, input);
  const counts = new Map(workload.outcomes.map(o => [o.taskId, o.scheduled]));
  const full = planned.filter(p => !p.scored.task.work?.alternativeFor);
  const trimmed = workload.outcomes.filter(o => o.scheduled < o.target)
    .map(o => ({ taskId: o.taskId, title: o.title, from: o.target, to: o.scheduled }));
  const unplaced = full.filter(p => (counts.get(p.scored.task.id) ?? 0) === 0);
  const spillover: Task[] = unplaced.filter(p => p.scored.task.frequency !== 'daily')
    .sort((a, b) => b.urgency - a.urgency || b.scored.score - a.scored.score || a.scored.task.id.localeCompare(b.scored.task.id))
    .slice(0, 10).map(p => p.scored.task);
  const maxDayBudget = Math.max(0, ...days.map(d => d.workload!.sessionBudget));
  const unscheduledCustomTasks: UnscheduledCustomTask[] = unplaced.filter(p => p.scored.task.tags.includes('custom'))
    .map(p => ({ taskId: p.scored.task.id, title: p.scored.task.title, frequency: p.scored.task.frequency,
      estimatedMinutes: p.scored.estimatedMinutes, reason: p.scored.estimatedMinutes > maxDayBudget ? 'daily_budget' : 'week_capacity' }));
  return { weekOf, days, spillover, metadata: {
    totalTasksScheduled: days.reduce((n, d) => n + d.tasks.length, 0), totalMinutesPlanned: workload.totalMinutes,
    season, pressure: buildPressureReport(full, days.reduce((n, d) => n + d.budget, 0), workload.totalMinutes, trimmed),
    workload, ...(unscheduledCustomTasks.length ? { unscheduledCustomTasks } : {}),
  } };
}

export type { WeekPlan, DayPlan, PlannerInput } from './types.js';
