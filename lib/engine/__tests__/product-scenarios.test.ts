import { describe, expect, it } from 'vitest';
import { scenarios } from './fixtures/product-scenarios.js';
import { generateWeekPlan } from '../planner.js';

describe('P1 household regression baseline and P2 improvements', () => {
  it.each(scenarios)('$id conserves the chosen budget and produces a deterministic capacity-safe plan', ({input}) => {
    const plan = generateWeekPlan(input);
    expect(plan).toEqual(generateWeekPlan(structuredClone(input)));
    expect(plan.weekOf.toISOString()).toBe('2026-11-02T00:00:00.000Z');
    expect(plan.days.reduce((n,d) => n+d.budget, 0)).toBe(input.profile!.weeklyHours! * 60);
    expect(plan.days).toHaveLength(7);
    for (const day of plan.days) {
      expect(day.budget % 5).toBe(0);
      expect(day.budget).toBeLessThanOrEqual(180);
      expect(day.totalMinutes).toBeLessThanOrEqual(day.budget);
      expect(day.totalMinutes).toBe(day.tasks.reduce((n,t) => n+t.estimatedMinutes, 0));
      expect(new Set(day.tasks.map(t => t.task.id)).size).toBe(day.tasks.length);
    }
  });
  it('keeps daily essentials in the single-parent plan', () => {
    const after = generateWeekPlan(scenarios[3]!.input);
    for (const day of after.days) {
      expect(day.tasks.map(t => t.task.id)).toEqual(expect.arrayContaining(['dishes', 'litter-box-scoop']));
    }
    expect(after.metadata.totalMinutesPlanned).toBeLessThanOrEqual(120);
    expect(after.metadata.workload!.outcomes.find(o => o.taskId === 'quick-bathroom-wipe')!.scheduled).toBe(0);
  });
  it('exposes unscheduled custom tasks in the constrained large household', () => {
    const plan = generateWeekPlan(scenarios[7]!.input);
    expect(plan.days.reduce((n,d) => n+d.budget, 0)).toBe(210);
    expect(plan.metadata.unscheduledCustomTasks?.map(t => t.taskId).sort()).toEqual(['custom-p1-pet-bedding', 'custom-p1-playroom']);
  });
});
