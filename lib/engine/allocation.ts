import { canFit, getFatigueThreshold, placeTask } from './budgeter.js';
import { FREQUENCY_WEIGHT } from './scorer.js';
import { workCategory } from './household-work.js';
import { zoneAnchorMultiplier } from '../tasks/zones.js';
import type { PlannedTask } from './pressure.js';
import type { DayPlan, PlannerInput, Task, TaskOutcome, WorkloadReport } from './types.js';

export function matchesPriority(task: Task, priorities: PlannerInput['priorities']): boolean {
  // A priority favours routine work in that area. Monthly deep cleans keep
  // their own rotation and never outrank the week's basics.
  if (task.frequency === 'monthly') return false;
  return (priorities ?? []).some(p =>
    p === 'kitchen-reset' ? task.zone === 'kitchen' :
    p === 'bathrooms' ? task.zone === 'bathroom' && !task.tags.includes('pet') :
    p === 'floors' ? task.tags.includes('floors') :
    p === 'clutter' ? task.tags.includes('clutter') : task.tags.includes('pet'));
}

/** No implicit extra allowance. Unused separate-upkeep minutes cannot be lent
 * to cleaning, nor cleaning minutes to upkeep. Both share the same fatigue cap. */
export function allocateWork(days: DayPlan[], planned: PlannedTask[], input: PlannerInput): WorkloadReport {
  const upkeep = input.upkeepTime ?? input.profile?.upkeepTime;
  const mode = upkeep?.mode ?? 'included';
  if (mode !== 'included' && mode !== 'separate') throw new RangeError('Unknown upkeep budget interpretation');
  const extra = upkeep?.mode === 'separate' ? upkeep.additionalDayBudgets : days.map(() => 0);
  if (!Array.isArray(extra) || extra.length !== 7 || extra.some((n, i) => !Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n + days[i]!.budget > 180 || (n > 0 && input.noGoDays?.includes(days[i]!.dayOfWeek)))) {
    throw new RangeError('Separate upkeep requires seven explicit additional minute limits within combined daily capacity');
  }
  for (const [i, day] of days.entries()) {
    day.workload = { sessionBudget: day.budget, additionalUpkeepBudget: extra[i]!, upkeepMinutes: 0, cleaningMinutes: 0 };
    day.budget += extra[i]!;
  }
  const count = (id: string) => days.reduce((n, d) => n + Number(d.tasks.some(t => t.task.id === id)), 0);
  const isUpkeep = (p: PlannedTask) => p.scored.task.work?.kind === 'upkeep';
  const fits = (day: DayPlan, p: PlannedTask) => {
    if (day.tasks.some(t => t.task.id === p.scored.task.id) || !canFit(day, p.scored)) return false;
    if (mode === 'included') return true;
    const w = day.workload!;
    return isUpkeep(p)
      ? w.upkeepMinutes + p.scored.estimatedMinutes <= w.additionalUpkeepBudget
      : w.cleaningMinutes + p.scored.estimatedMinutes <= w.sessionBudget;
  };
  const place = (day: DayPlan, p: PlannedTask) => {
    placeTask(day, p.scored);
    if (isUpkeep(p)) day.workload!.upkeepMinutes += p.scored.estimatedMinutes;
    else day.workload!.cleaningMinutes += p.scored.estimatedMinutes;
  };
  const core = planned.filter(p => !p.scored.task.work?.alternativeFor);
  const alternatives = planned.filter(p => p.scored.task.work?.alternativeFor);
  // Daily hygiene is day-specific: a second Saturday occurrence cannot repair
  // a missing Thursday. Preserve exact missing dates in the final report.
  const careOrder = ['dishes', 'litter-box-scoop', 'dog-water-bowl-refresh', 'cat-food-water-bowls'];
  for (const day of days) {
    for (const p of core.filter(isUpkeep).sort((a, b) => careOrder.indexOf(a.scored.task.id) - careOrder.indexOf(b.scored.task.id))) {
      if (count(p.scored.task.id) < p.ideal && fits(day, p)) place(day, p);
    }
  }
  // Select one occurrence at a time. Frequency no longer gives the seventh
  // optional pickup 10x the score of the only laundry session. Diminishing
  // returns encourage maintenance variety, with no equal-minute zone quotas.
  while (true) {
    let winner: { p: PlannedTask; day: DayPlan; value: number } | undefined;
    for (const p of [...core.filter(p => !isUpkeep(p)), ...alternatives]) {
      const task = p.scored.task, done = count(task.id);
      if (done >= p.ideal) continue;
      const parent = task.work?.alternativeFor ? core.find(c => c.scored.task.id === task.work!.alternativeFor) : undefined;
      if (task.work?.alternativeFor && (!parent || count(parent.scored.task.id) > 0 || days.some(d => fits(d, parent)))) continue;
      if (alternatives.some(a => a.scored.task.work!.alternativeFor === task.id && count(a.scored.task.id) > 0)) continue;
      const candidates = days.filter(d => fits(d, p));
      if (!candidates.length) continue;
      const category = workCategory(task);
      const categoryCount = days.flatMap(d => d.tasks).filter(t => t.task.work?.kind !== 'upkeep' && workCategory(t.task) === category).length;
      const required = (parent ?? p).scored.task.work?.essentialOccurrences ?? 0;
      const essential = required > count((parent ?? p).scored.task.id);
      const base = p.scored.score / FREQUENCY_WEIGHT[task.frequency];
      // Alternative inherits the full task's importance, not its old frequency
      // weight. User-defined tasks retain exact duration and meaningful value.
      const value = base * Math.pow(0.3 + task.chaosImpact, 2)
        * (task.tags.includes('core') ? 1.5 : 1) * (task.tags.includes('custom') ? 2 : 1)
        * (essential ? 20 : 1) * (matchesPriority(task, input.priorities) ? 4 : 1)
        * Math.max(0.25, Math.min(4, p.urgency))
        / ((1 + done) * (1 + categoryCount * 0.5) * Math.sqrt(p.scored.estimatedMinutes));
      // Space repeats where possible. Packing uses the largest remaining slot
      // after a modest familiar-zone preference, never a minute quota per zone.
      const used = days.map((d, i) => d.tasks.some(t => t.task.id === task.id) ? i : -1).filter(i => i >= 0);
      const placementValue = (d: DayPlan) => {
        const i = days.indexOf(d);
        const adjacent = used.some(j => Math.abs(i - j) === 1 || Math.abs(i - j) === 6);
        return (adjacent ? 0 : 1000) + (d.budget - d.totalMinutes) * zoneAnchorMultiplier(task.zone, d.dayOfWeek);
      };
      const day = [...candidates].sort((a, b) => placementValue(b) - placementValue(a))[0]!;
      if (!winner || value > winner.value || (value === winner.value && task.id < winner.p.scored.task.id)) winner = { p, day, value };
    }
    if (!winner) break;
    place(winner.day, winner.p);
  }
  const outcomes: TaskOutcome[] = core.map(p => {
    const task = p.scored.task, scheduled = count(task.id);
    const maxBudget = Math.max(0, ...days.map(d => mode === 'included' ? d.budget : isUpkeep(p) ? d.workload!.additionalUpkeepBudget : d.workload!.sessionBudget));
    const reason = scheduled >= p.ideal ? null : p.scored.estimatedMinutes > maxBudget ? 'task_too_long'
      : days.every(d => d.budget === 0 || task.fatigueCost > getFatigueThreshold(d.dayOfWeek)) ? 'fatigue_limit' : 'capacity';
    return { taskId: task.id, title: task.title, category: workCategory(task), scope: task.work?.scope ?? 'Complete custom task',
      kind: isUpkeep(p) ? 'upkeep' : 'cleaning', estimatedMinutes: p.scored.estimatedMinutes,
      target: p.ideal, scheduled, essential: task.work?.essentialOccurrences ?? 0,
      priority: matchesPriority(task, input.priorities), overdue: p.urgency > 1, reason,
      missingDays: isUpkeep(p) ? days.flatMap((d, i) => d.tasks.some(t => t.task.id === task.id) ? [] : [i]) : [],
      alternatives: alternatives.filter(a => a.scored.task.work!.alternativeFor === task.id && count(a.scored.task.id) > 0)
        .map(a => ({ taskId: a.scored.task.id, title: a.scored.task.title, scope: a.scored.task.work!.scope, scheduled: count(a.scored.task.id) })) };
  });
  const sum = (key: keyof NonNullable<DayPlan['workload']>) => days.reduce((n, d) => n + d.workload![key], 0);
  return { version: 2, mode, sessionBudgetMinutes: sum('sessionBudget'), additionalUpkeepBudgetMinutes: sum('additionalUpkeepBudget'),
    upkeepMinutes: sum('upkeepMinutes'), cleaningMinutes: sum('cleaningMinutes'), totalMinutes: sum('upkeepMinutes') + sum('cleaningMinutes'), outcomes };
}
