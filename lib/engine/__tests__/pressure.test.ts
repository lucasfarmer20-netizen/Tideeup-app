import { describe, it, expect } from 'vitest';
import { generateWeekPlan } from '../planner.js';
import { planOccurrences, demandMinutes, trimToSupply } from '../pressure.js';
import { scoreAndSort } from '../scorer.js';
import { TASK_LIBRARY } from '../../tasks/library.js';
import type { PlannerInput } from '../types.js';

const BASE: PlannerInput = {
  homeSize: 'M',
  homeType: 'single-family',
  householdCount: 2,
  petTypes: [],
  kids: false,
  flooringTypes: ['hardwood', 'carpet'],
  timePreference: 'steady',
  weekOf: new Date('2025-06-09T00:00:00Z'),
  seasonOverride: 'summer',
};

function plannedFor(input: PlannerInput) {
  const scored = scoreAndSort(TASK_LIBRARY, input, 'summer', 6);
  return planOccurrences(scored, input.weekOf, input.rotationState, input.priorities);
}

describe('trimToSupply', () => {
  it('does nothing when demand already fits', () => {
    const planned = plannedFor(BASE);
    const trimmed = trimToSupply(planned, 100000);
    expect(trimmed).toEqual([]);
    expect(demandMinutes(planned, 'occurrences')).toBe(demandMinutes(planned, 'ideal'));
  });

  it('brings demand under supply × headroom when floors allow', () => {
    const planned = plannedFor({ ...BASE, timePreference: 'thorough' });
    const supply = 460;
    trimToSupply(planned, supply);
    expect(demandMinutes(planned, 'occurrences')).toBeLessThanOrEqual(supply * 0.92);
  });

  it('never trims protected tasks or goes below a floor', () => {
    const planned = plannedFor({ ...BASE, timePreference: 'quick' });
    trimToSupply(planned, 50); // absurdly small
    for (const p of planned) {
      if (p.protected) expect(p.occurrences).toBe(p.ideal);
      expect(p.occurrences).toBeGreaterThanOrEqual(p.min);
    }
  });

  it('trims recently-done tasks before overdue ones (paid tier)', () => {
    const weekOf = BASE.weekOf;
    const recent = new Date(weekOf.getTime() - 6 * 86400000).toISOString().slice(0, 10);
    const overdue = new Date(weekOf.getTime() - 20 * 86400000).toISOString().slice(0, 10);
    const input: PlannerInput = {
      ...BASE,
      rotationState: {
        lastDone: { 'scrub-toilet': recent, 'clean-shower-tub': overdue },
        memberAssignments: {},
      },
    };
    const plan = generateWeekPlan(input);
    const placed = (id: string) => plan.days.some((d) => d.tasks.some((t) => t.task.id === id));
    expect(placed('clean-shower-tub')).toBe(true);
    // The overdue task is kept over the one done six days ago.
    if (!placed('scrub-toilet')) {
      expect(plan.metadata.pressure.trimmed.map((t) => t.taskId)).toContain('scrub-toilet');
    }
  });

  it('is deterministic', () => {
    const a = generateWeekPlan({ ...BASE, timePreference: 'quick' });
    const b = generateWeekPlan({ ...BASE, timePreference: 'quick' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('pressure report', () => {
  it('reports supply, demand, ratio and coverage', () => {
    const plan = generateWeekPlan(BASE);
    const p = plan.metadata.pressure;
    expect(p.supplyMinutes).toBe(290);
    expect(p.demandMinutes).toBeGreaterThan(p.supplyMinutes);
    expect(p.ratio).toBeGreaterThan(1);
    expect(p.coverage).toBeGreaterThan(0);
    expect(p.coverage).toBeLessThanOrEqual(1);
    expect(p.trimmed.length).toBeGreaterThan(0);
    for (const t of p.trimmed) expect(t.to).toBeLessThan(t.from);
  });

  it('coverage rises with more time', () => {
    const quick = generateWeekPlan({ ...BASE, timePreference: 'quick' }).metadata.pressure.coverage;
    const steady = generateWeekPlan({ ...BASE, timePreference: 'steady' }).metadata.pressure.coverage;
    const thorough = generateWeekPlan({ ...BASE, timePreference: 'thorough' }).metadata.pressure.coverage;
    expect(steady).toBeGreaterThan(quick);
    expect(thorough).toBeGreaterThan(steady);
  });

  it('trimmed-to-zero weekly tasks surface in spillover', () => {
    const plan = generateWeekPlan({ ...BASE, timePreference: 'quick' });
    const zeroed = plan.metadata.pressure.trimmed.filter((t) => t.to === 0).map((t) => t.taskId);
    expect(zeroed.length).toBeGreaterThan(0);
    expect(plan.spillover.length).toBeGreaterThan(0);
    for (const t of plan.spillover) expect(zeroed).toContain(t.id);
  });
});

describe('balance and per-day budgets', () => {
  it('fills weekdays close to budget at steady (no empty weekdays)', () => {
    const plan = generateWeekPlan(BASE);
    for (const d of plan.days) {
      expect(d.totalMinutes).toBeLessThanOrEqual(d.budget);
      expect(d.totalMinutes / d.budget).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('spreads a degraded daily task across non-adjacent days when possible', () => {
    const plan = generateWeekPlan(BASE);
    const idx = plan.days
      .map((d, i) => (d.tasks.some((t) => t.task.id === 'make-beds') ? i : -1))
      .filter((i) => i >= 0);
    expect(idx.length).toBeGreaterThanOrEqual(2);
    if (idx.length <= 3) {
      for (let a = 0; a < idx.length; a++)
        for (let b = a + 1; b < idx.length; b++)
          expect(Math.abs(idx[a]! - idx[b]!)).not.toBe(1);
    }
  });

  it('honours caller-supplied per-day budgets (Pro sliders)', () => {
    const dayBudgets = [20, 20, 0, 20, 20, 120, 60];
    const plan = generateWeekPlan({ ...BASE, dayBudgets });
    plan.days.forEach((d, i) => {
      expect(d.budget).toBe(dayBudgets[i]);
      expect(d.totalMinutes).toBeLessThanOrEqual(d.budget);
    });
    expect(plan.days[2]!.tasks).toHaveLength(0);
    expect(plan.metadata.pressure.supplyMinutes).toBe(260);
  });

  it('priorities protect matching tasks from trimming', () => {
    const plan = generateWeekPlan({ ...BASE, timePreference: 'quick', priorities: ['floors'] });
    const trimmed = plan.metadata.pressure.trimmed.map((t) => t.taskId);
    expect(trimmed).not.toContain('sweep-high-traffic');
    expect(trimmed).not.toContain('mop-kitchen-floor');
  });
});
