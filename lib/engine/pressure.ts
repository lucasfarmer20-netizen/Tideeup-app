/**
 * Pressure — compare what the home needs this week with the time the
 * household has, and degrade cadences gracefully when it doesn't fit.
 *
 * The degradation order encodes what a tired household drops first:
 *   1. Protected tasks are never trimmed (library floor + quiz priorities).
 *   2. Among the rest, lowest urgency first — things done recently, or not
 *      yet due, slip before things that are overdue.
 *   3. Ties break on value density (score per minute): the expensive,
 *      low-value task goes before the cheap, high-value one.
 *
 * Trimming is one occurrence at a time, round-robin through that order, so a
 * mildly over-committed week loses a little from several low-priority tasks
 * rather than everything from one. Pure, deterministic.
 */

import type { PressureReport, Priority, RotationState, ScoredTask, TrimmedTask } from './types.js';
import { isProtected, minOccurrencesThisWeek, occurrencesThisWeek, urgency } from './cadence.js';
import { FREQUENCY_WEIGHT } from './scorer.js';

/** A scored task with how many times it should happen this week. */
export interface PlannedTask {
  scored: ScoredTask;
  /** Occurrences before any trimming */
  ideal: number;
  /** Occurrences after trimming — what the planner will try to place */
  occurrences: number;
  /** Floor the trimmer may not go below */
  min: number;
  protected: boolean;
  urgency: number;
}

export function planOccurrences(
  scored: ScoredTask[],
  weekOf: Date,
  rotationState: RotationState | undefined,
  priorities: Priority[] | undefined,
): PlannedTask[] {
  const out: PlannedTask[] = [];
  for (const s of scored) {
    const ideal = occurrencesThisWeek(s.task, weekOf, rotationState);
    if (ideal === 0) continue;
    out.push({
      scored: s,
      ideal,
      occurrences: ideal,
      min: minOccurrencesThisWeek(s.task, ideal),
      protected: isProtected(s.task, priorities),
      urgency: urgency(s.task, weekOf, rotationState),
    });
  }
  return out;
}

export function demandMinutes(planned: PlannedTask[], field: 'ideal' | 'occurrences' = 'ideal'): number {
  return planned.reduce((sum, p) => sum + p[field] * p.scored.estimatedMinutes, 0);
}

/**
 * Value of the *next occurrence to be removed*, per minute.
 *
 * The scorer's frequency weight (daily 100 / weekly 10 / monthly 1) exists to
 * order placement, not to say that the seventh bed-making is worth ten toilet
 * scrubs. For trimming we strip it back out and spread a task's household
 * value across its remaining occurrences, so a daily task's sixth and seventh
 * days compete fairly with a weekly task's only day.
 */
function marginalDensity(p: PlannedTask): number {
  const task = p.scored.task;
  const base = p.scored.score / FREQUENCY_WEIGHT[task.frequency];
  // Importance: the library's chaosImpact is the "how bad is it if this slips"
  // signal (dishes, litter and bathrooms high; dusting blinds low). Squared so
  // the spread between a 0.6 and a 0.1 task is decisive, with a floor so
  // zero-chaos maintenance tasks still have some value. `core` weekly tasks
  // get a modest boost over `quick` filler.
  const importance = Math.pow(0.3 + task.chaosImpact, 2) * (task.tags.includes('core') ? 1.25 : 1);
  const perOccurrence = (base * importance) / Math.max(1, p.occurrences);
  // Duration counts against a task, but sub-linearly: a 20-minute vacuum is
  // not four times less worth doing than a 5-minute wipe.
  const m = p.scored.estimatedMinutes;
  return m > 0 ? perOccurrence / Math.sqrt(m) : perOccurrence;
}

/**
 * Reduce occurrences until demand fits supply (or every task is at its floor).
 * Mutates `occurrences` on the given PlannedTasks and returns what was trimmed.
 *
 * `headroom` leaves a little slack for the bin-packer: per-day budgets rarely
 * fill perfectly, so aiming for ~92% of supply places more of what we keep.
 */
export function trimToSupply(
  planned: PlannedTask[],
  supplyMinutes: number,
  headroom = 0.92,
): TrimmedTask[] {
  const target = supplyMinutes * headroom;
  let demand = demandMinutes(planned, 'occurrences');
  if (demand <= target) return [];

  const candidates = planned.filter((p) => !p.protected);

  // Each step removes the single least-valuable remaining occurrence across
  // all candidates: lowest urgency first (recently done slips before overdue),
  // then lowest marginal value per minute. Marginal value rises as a task
  // loses occurrences, so trimming naturally spreads across tasks rather
  // than emptying one.
  while (demand > target) {
    let victim: PlannedTask | undefined;
    let victimKey: [number, number, string] | undefined;
    for (const p of candidates) {
      if (p.occurrences <= p.min) continue;
      const key: [number, number, string] = [p.urgency, marginalDensity(p), p.scored.task.id];
      if (
        !victimKey ||
        key[0] < victimKey[0] ||
        (key[0] === victimKey[0] && key[1] < victimKey[1]) ||
        (key[0] === victimKey[0] && key[1] === victimKey[1] && key[2] < victimKey[2])
      ) {
        victim = p;
        victimKey = key;
      }
    }
    if (!victim) break; // everything is at its floor
    victim.occurrences -= 1;
    demand -= victim.scored.estimatedMinutes;
  }

  return trimmedReport(planned);
}

/** Current trimmed-task list from the planned set (after any backfill). */
export function trimmedReport(planned: PlannedTask[]): TrimmedTask[] {
  return planned
    .filter((p) => p.occurrences < p.ideal)
    .map((p) => ({
      taskId: p.scored.task.id,
      title: p.scored.task.title,
      from: p.ideal,
      to: p.occurrences,
    }));
}

/**
 * Candidates for restoring an occurrence after placement, most valuable first:
 * highest urgency, then highest marginal value per minute. The planner calls
 * this once the week is packed, to use slack the trimmer couldn't see.
 */
export function backfillOrder(planned: PlannedTask[]): PlannedTask[] {
  return planned
    .filter((p) => p.occurrences < p.ideal)
    .sort((a, b) => {
      if (a.urgency !== b.urgency) return b.urgency - a.urgency;
      const d = marginalDensity(b) - marginalDensity(a);
      if (d !== 0) return d;
      return a.scored.task.id.localeCompare(b.scored.task.id);
    });
}

export function buildPressureReport(
  planned: PlannedTask[],
  supplyMinutes: number,
  plannedMinutes: number,
  trimmed: TrimmedTask[],
): PressureReport {
  const demand = demandMinutes(planned, 'ideal');
  const ratio = supplyMinutes > 0 ? demand / supplyMinutes : Infinity;
  const coverage = demand > 0 ? Math.min(1, plannedMinutes / demand) : 1;
  return {
    supplyMinutes,
    demandMinutes: Math.round(demand),
    ratio: Math.round(ratio * 100) / 100,
    coverage: Math.round(coverage * 100) / 100,
    trimmed,
  };
}
