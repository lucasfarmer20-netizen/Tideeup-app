import { describe, it, expect } from 'vitest';
import { generateWeekPlan } from '../planner.js';
import type { FlooringType, HomeType, PetType, PlannerInput, RotationState } from '../types.js';

const BASE_INPUT: PlannerInput = {
  homeSize: 'M',
  homeType: 'single-family',
  householdCount: 2,
  petTypes: [],
  kids: false,
  flooringTypes: ['hardwood', 'carpet'],
  timePreference: 'steady',
  weekOf: new Date('2025-06-11T00:00:00Z'), // Wednesday — engine normalises to Monday
  seasonOverride: 'summer', // avoid seasonal month filtering surprises in tests
};

describe('generateWeekPlan — structure', () => {
  it('returns exactly 7 days', () => {
    const plan = generateWeekPlan(BASE_INPUT);
    expect(plan.days).toHaveLength(7);
  });

  it('normalises weekOf to a Monday', () => {
    const plan = generateWeekPlan(BASE_INPUT);
    expect(plan.weekOf.getUTCDay()).toBe(1);
  });

  it('first day is Monday (dayOfWeek = 1)', () => {
    const plan = generateWeekPlan(BASE_INPUT);
    expect(plan.days[0]!.dayOfWeek).toBe(1);
  });

  it('last day is Sunday (dayOfWeek = 0)', () => {
    const plan = generateWeekPlan(BASE_INPUT);
    expect(plan.days[6]!.dayOfWeek).toBe(0);
  });

  it('includes metadata with season, task count, and minutes', () => {
    const plan = generateWeekPlan(BASE_INPUT);
    expect(plan.metadata.season).toBe('summer');
    expect(plan.metadata.totalTasksScheduled).toBeGreaterThan(0);
    expect(plan.metadata.totalMinutesPlanned).toBeGreaterThan(0);
  });

  it('has spillover as an array', () => {
    const plan = generateWeekPlan(BASE_INPUT);
    expect(Array.isArray(plan.spillover)).toBe(true);
  });

  it('every scheduled task has a positive estimatedMinutes', () => {
    const plan = generateWeekPlan(BASE_INPUT);
    for (const day of plan.days) {
      for (const t of day.tasks) {
        expect(t.estimatedMinutes).toBeGreaterThan(0);
      }
    }
  });
});

describe('generateWeekPlan — daily stabilisers', () => {
  it('dishes appears on every day', () => {
    // dishes is the highest-priority universal daily task
    const plan = generateWeekPlan({ ...BASE_INPUT, timePreference: 'thorough' });
    for (const day of plan.days) {
      const ids = day.tasks.map((t) => t.task.id);
      expect(ids).toContain('dishes');
    }
  });

  it('daily tasks appear on multiple days (not just one)', () => {
    const plan = generateWeekPlan(BASE_INPUT);
    const dailyTasksPerDay = plan.days.map(
      (d) => d.tasks.filter((t) => t.task.frequency === 'daily').length,
    );
    const daysWithDailyTasks = dailyTasksPerDay.filter((c) => c > 0).length;
    expect(daysWithDailyTasks).toBe(7);
  });

  it('daily stabilisers do not exceed 60% of each day budget', () => {
    const plan = generateWeekPlan(BASE_INPUT);
    for (const day of plan.days) {
      const stabilizerMinutes = day.tasks
        .filter((t) => t.task.frequency === 'daily')
        .reduce((sum, t) => sum + t.estimatedMinutes, 0);
      expect(stabilizerMinutes).toBeLessThanOrEqual(Math.ceil(day.budget * 0.6));
    }
  });

  it('does not include cat tasks when petTypes is empty', () => {
    const plan = generateWeekPlan({ ...BASE_INPUT, petTypes: [] });
    for (const day of plan.days) {
      const hasCatTask = day.tasks.some((t) => t.task.petTypes?.includes('cat-1-2'));
      expect(hasCatTask).toBe(false);
    }
  });

  it('includes cat daily tasks when petTypes includes cats', () => {
    // thorough gives enough weekend budget for mandatory cat care tasks to fit
    const plan = generateWeekPlan({
      ...BASE_INPUT,
      timePreference: 'thorough',
      petTypes: ['cat-1-2'] as PetType[],
    });
    const catDailyAnyDay = plan.days.some((d) =>
      d.tasks.some(
        (t) => t.task.petTypes?.includes('cat-1-2') && t.task.frequency === 'daily',
      ),
    );
    expect(catDailyAnyDay).toBe(true);
  });

  it('includes litter box scoop daily when cats present', () => {
    const plan = generateWeekPlan({
      ...BASE_INPUT,
      timePreference: 'thorough',
      petTypes: ['cat-1-2'] as PetType[],
    });
    const hasLitterScoop = plan.days.some((d) =>
      d.tasks.some((t) => t.task.id === 'litter-box-scoop'),
    );
    expect(hasLitterScoop).toBe(true);
  });

  it('sweep-high-traffic only appears with compatible flooring', () => {
    // thorough gives Saturday enough budget to include lower-priority stabilizers
    const withHardwood = generateWeekPlan({ ...BASE_INPUT, timePreference: 'thorough', flooringTypes: ['hardwood'] });
    const carpetOnly   = generateWeekPlan({ ...BASE_INPUT, timePreference: 'thorough', flooringTypes: ['carpet']   });

    const hasInHardwood = withHardwood.days.some((d) =>
      d.tasks.some((t) => t.task.id === 'sweep-high-traffic'),
    );
    const hasInCarpet = carpetOnly.days.some((d) =>
      d.tasks.some((t) => t.task.id === 'sweep-high-traffic'),
    );
    expect(hasInHardwood).toBe(true);
    expect(hasInCarpet).toBe(false);
  });
});

describe('generateWeekPlan — budget constraints', () => {
  it('no day exceeds its time budget', () => {
    const plan = generateWeekPlan(BASE_INPUT);
    for (const day of plan.days) {
      expect(day.totalMinutes).toBeLessThanOrEqual(day.budget);
    }
  });

  it('no day exceeds its time budget with XL home', () => {
    const plan = generateWeekPlan({ ...BASE_INPUT, homeSize: 'XL', householdCount: 5 });
    for (const day of plan.days) {
      expect(day.totalMinutes).toBeLessThanOrEqual(day.budget);
    }
  });

  it('batch mode gives much more time on weekends than weekdays', () => {
    const plan     = generateWeekPlan({ ...BASE_INPUT, timePreference: 'batch' });
    const saturday = plan.days.find((d) => d.dayOfWeek === 6)!;
    const monday   = plan.days.find((d) => d.dayOfWeek === 1)!;
    expect(saturday.budget).toBeGreaterThan(monday.budget * 4);
  });

  it('thorough preference allows more total minutes than quick', () => {
    const thorough = generateWeekPlan({ ...BASE_INPUT, timePreference: 'thorough' });
    const quick    = generateWeekPlan({ ...BASE_INPUT, timePreference: 'quick'    });
    const totalThorough = thorough.days.reduce((s, d) => s + d.budget, 0);
    const totalQuick    = quick.days.reduce((s, d) => s + d.budget, 0);
    expect(totalThorough).toBeGreaterThan(totalQuick);
  });

  it('quick mode weekday budget matches the label (~20 min)', () => {
    const plan   = generateWeekPlan({ ...BASE_INPUT, timePreference: 'quick' });
    const monday = plan.days.find((d) => d.dayOfWeek === 1)!;
    expect(monday.budget).toBe(20);
  });

  it('no-go days are skipped (budget = 0)', () => {
    const plan = generateWeekPlan({ ...BASE_INPUT, noGoDays: [3] }); // Wednesday
    const wednesday = plan.days.find((d) => d.dayOfWeek === 3)!;
    expect(wednesday.totalMinutes).toBe(0);
    expect(wednesday.tasks).toHaveLength(0);
  });
});

describe('generateWeekPlan — monthly task placement', () => {
  it('places at least one monthly task or reports it as spillover', () => {
    const plan = generateWeekPlan({ ...BASE_INPUT, timePreference: 'thorough' });
    const monthlyPlaced   = plan.days.some((d) => d.tasks.some((t) => t.task.frequency === 'monthly'));
    const monthlySpillover = plan.spillover.some((t) => t.frequency === 'monthly');
    expect(monthlyPlaced || monthlySpillover).toBe(true);
  });

  it('prefers weekend days for monthly tasks', () => {
    const plan = generateWeekPlan({ ...BASE_INPUT, timePreference: 'thorough' });
    const monthlyOnWeekend = plan.days.some(
      (d) =>
        (d.dayOfWeek === 0 || d.dayOfWeek === 6) &&
        d.tasks.some((t) => t.task.frequency === 'monthly'),
    );
    // This should be true for thorough mode with enough budget on weekends
    // (not guaranteed if weekend is already full, but expected in practice)
    const monthlyExistsAnywhere =
      plan.days.some((d) => d.tasks.some((t) => t.task.frequency === 'monthly')) ||
      plan.spillover.length > 0;
    expect(monthlyExistsAnywhere).toBe(true);
    // If any monthly was placed, at least one should be on a weekend
    if (plan.days.some((d) => d.tasks.some((t) => t.task.frequency === 'monthly'))) {
      expect(monthlyOnWeekend).toBe(true);
    }
  });
});

describe('generateWeekPlan — season detection', () => {
  it('auto-detects winter when weekOf is in January and no override', () => {
    const { seasonOverride: _so, ...baseNoOverride } = BASE_INPUT;
    const plan = generateWeekPlan({
      ...baseNoOverride,
      weekOf: new Date('2025-01-06T00:00:00Z'),
    });
    expect(plan.metadata.season).toBe('winter');
  });

  it('respects seasonOverride', () => {
    const plan = generateWeekPlan({ ...BASE_INPUT, seasonOverride: 'fall' });
    expect(plan.metadata.season).toBe('fall');
  });

  it('auto-detects summer for June', () => {
    const { seasonOverride: _so2, ...baseNoOverride2 } = BASE_INPUT;
    const plan = generateWeekPlan({
      ...baseNoOverride2,
      weekOf: new Date('2025-06-02T00:00:00Z'),
    });
    expect(plan.metadata.season).toBe('summer');
  });
});

describe('generateWeekPlan — rotation state', () => {
  it('excludes recently-done weekly tasks when rotation state is provided', () => {
    const state: RotationState = {
      lastDone: { 'laundry-wash-dry': '2025-06-09' }, // done this Monday
      memberAssignments: {},
    };
    const plan = generateWeekPlan({
      ...BASE_INPUT,
      weekOf: new Date('2025-06-09T00:00:00Z'),
      rotationState: state,
    });
    const placed = plan.days.some((d) =>
      d.tasks.some((t) => t.task.id === 'laundry-wash-dry'),
    );
    expect(placed).toBe(false);
  });

  it('includes all tasks when no rotation state', () => {
    const { rotationState: _rs, ...baseNoRotation } = BASE_INPUT;
    const plan = generateWeekPlan({ ...baseNoRotation });
    const hasLaundry = plan.days.some((d) =>
      d.tasks.some((t) => t.task.id === 'laundry-wash-dry'),
    );
    expect(hasLaundry).toBe(true);
  });
});

describe('generateWeekPlan — household scaling', () => {
  it('XL home tasks have higher average per-task duration than S home', () => {
    const xl = generateWeekPlan({ ...BASE_INPUT, homeSize: 'XL' });
    const s  = generateWeekPlan({ ...BASE_INPUT, homeSize: 'S'  });
    const avgMinutes = (plan: ReturnType<typeof generateWeekPlan>) => {
      const allTasks = plan.days.flatMap((d) => d.tasks);
      return allTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0) / allTasks.length;
    };
    expect(avgMinutes(xl)).toBeGreaterThan(avgMinutes(s));
  });

  it('6+ household generates a valid plan', () => {
    expect(() =>
      generateWeekPlan({ ...BASE_INPUT, householdCount: 6 }),
    ).not.toThrow();
  });

  it('single-member household generates a valid plan', () => {
    const plan = generateWeekPlan({ ...BASE_INPUT, householdCount: 1 });
    expect(plan.days).toHaveLength(7);
  });
});

describe('generateWeekPlan — home type filtering', () => {
  it('excludes outdoor mowing tasks for apartments', () => {
    const plan = generateWeekPlan({
      ...BASE_INPUT,
      homeType: 'apartment',
      seasonOverride: 'summer', // month 6, mow-lawn is months 4-10
      weekOf: new Date('2025-06-02T00:00:00Z'),
    });
    const hasMowLawn = plan.days.some((d) =>
      d.tasks.some((t) => t.task.id === 'mow-lawn'),
    );
    expect(hasMowLawn).toBe(false);
  });

  it('includes outdoor tasks for single-family homes in season', () => {
    const { seasonOverride: _so3, ...baseNoOverride3 } = BASE_INPUT;
    const plan = generateWeekPlan({
      ...baseNoOverride3,
      homeType: 'single-family',
      timePreference: 'thorough',
      weekOf: new Date('2025-06-02T00:00:00Z'),
    });
    const hasOutdoor = plan.days.some((d) =>
      d.tasks.some((t) => t.task.zone === 'outdoor'),
    ) || plan.spillover.some((t) => t.zone === 'outdoor');
    expect(hasOutdoor).toBe(true);
  });
});

describe('generateWeekPlan — flooring filtering', () => {
  it('excludes carpet tasks for all-hardwood home', () => {
    const plan = generateWeekPlan({ ...BASE_INPUT, flooringTypes: ['hardwood'] });
    const hasCarpetTask = plan.days.some((d) =>
      d.tasks.some((t) => t.task.id === 'vacuum-carpet-living'),
    );
    expect(hasCarpetTask).toBe(false);
  });

  it('excludes hardwood tasks for all-carpet home', () => {
    const plan = generateWeekPlan({ ...BASE_INPUT, flooringTypes: ['carpet'] });
    const hasMopHardwood = plan.days.some((d) =>
      d.tasks.some((t) => t.task.id === 'mop-hardwood-living'),
    );
    expect(hasMopHardwood).toBe(false);
  });
});

describe('generateWeekPlan — determinism', () => {
  it('produces identical output for the same input', () => {
    const a = generateWeekPlan(BASE_INPUT);
    const b = generateWeekPlan(BASE_INPUT);
    for (let i = 0; i < 7; i++) {
      expect(a.days[i]!.tasks.length).toBe(b.days[i]!.tasks.length);
      expect(a.days[i]!.totalMinutes).toBe(b.days[i]!.totalMinutes);
    }
    expect(a.spillover.length).toBe(b.spillover.length);
  });
});

describe('generateWeekPlan — custom tasks', () => {
  it('incorporates custom tasks into the plan', () => {
    const customTask = {
      id: 'custom-test-task',
      title: 'Test custom task',
      zone: 'general' as const,
      frequency: 'weekly' as const,
      typicalMinutes: { S: 10, M: 10, L: 10, XL: 10 },
      chaosImpact: 0.1,
      fatigueCost: 0.1,
      tags: ['custom'],
      flooringTypes: null,
      petTypes: null,
      seasonalMonths: null,
      homeTypes: null,
    };
    const plan = generateWeekPlan({
      ...BASE_INPUT,
      timePreference: 'thorough',
      customTasks: [customTask],
    });
    const customPlaced = plan.days.some((d) =>
      d.tasks.some((t) => t.task.id === 'custom-test-task'),
    );
    const customInSpillover = plan.spillover.some((t) => t.id === 'custom-test-task');
    expect(customPlaced || customInSpillover).toBe(true);
  });
});
