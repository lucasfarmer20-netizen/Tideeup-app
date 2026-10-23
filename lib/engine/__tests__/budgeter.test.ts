import { describe, it, expect } from 'vitest';
import {
  getDayBudget,
  getFatigueThreshold,
  initDayPlans,
  canFit,
  placeTask,
  findBestDay,
  findBestWeekendDay,
} from '../budgeter.js';
import type { DayPlan, ScoredTask, Task } from '../types.js';

const MON = new Date('2025-06-09T00:00:00Z'); // Monday

function makeDay(dayOfWeek: number, budget = 60, fatigue = 0, totalMinutes = 0): DayPlan {
  return {
    date: new Date(),
    dayOfWeek,
    tasks: [],
    totalMinutes,
    budget,
    fatigue,
  };
}

function makeScoredTask(overrides: Partial<Task> & { estimatedMinutes?: number } = {}): ScoredTask {
  const task: Task = {
    id: overrides.id ?? 'test-task',
    title: 'Test',
    zone: overrides.zone ?? 'general',
    frequency: overrides.frequency ?? 'weekly',
    typicalMinutes: overrides.typicalMinutes ?? { S: 20, M: 20, L: 20, XL: 20 },
    chaosImpact: overrides.chaosImpact ?? 0.3,
    fatigueCost: overrides.fatigueCost ?? 0.3,
    tags: [],
    flooringTypes: null,
    petTypes: null,
    seasonalMonths: null,
    homeTypes: null,
    ...overrides,
  };
  return { task, score: 10, estimatedMinutes: overrides.estimatedMinutes ?? 20 };
}

describe('getDayBudget', () => {
  it('weekday steady preference = 35 min', () => {
    expect(getDayBudget(1, 'steady')).toBe(35); // Monday
  });
  it('Saturday steady preference = 65 min', () => {
    expect(getDayBudget(6, 'steady')).toBe(65);
  });
  it('Sunday steady preference = 50 min', () => {
    expect(getDayBudget(0, 'steady')).toBe(50);
  });
  it('batch weekday = 15 min', () => {
    expect(getDayBudget(3, 'batch')).toBe(15);
  });
  it('batch Saturday = 130 min', () => {
    expect(getDayBudget(6, 'batch')).toBe(130);
  });
  it('quick weekday = 20 min', () => {
    expect(getDayBudget(2, 'quick')).toBe(20);
  });
  it('thorough weekday = 55 min', () => {
    expect(getDayBudget(4, 'thorough')).toBe(55);
  });
  it('thorough Saturday > thorough weekday', () => {
    expect(getDayBudget(6, 'thorough')).toBeGreaterThan(getDayBudget(1, 'thorough'));
  });
  it('thorough allows more time than quick', () => {
    expect(getDayBudget(1, 'thorough')).toBeGreaterThan(getDayBudget(1, 'quick'));
  });
});

describe('getFatigueThreshold', () => {
  it('weekday threshold is lower than Saturday', () => {
    expect(getFatigueThreshold(1)).toBeLessThan(getFatigueThreshold(6));
  });
  it('Saturday allows more fatigue than Sunday', () => {
    expect(getFatigueThreshold(6)).toBeGreaterThan(getFatigueThreshold(0));
  });
  it('returns a positive value for all days', () => {
    for (let d = 0; d < 7; d++) {
      expect(getFatigueThreshold(d)).toBeGreaterThan(0);
    }
  });
});

describe('initDayPlans', () => {
  it('creates exactly 7 days', () => {
    const days = initDayPlans(MON, 'steady');
    expect(days).toHaveLength(7);
  });

  it('first day is Monday (dayOfWeek = 1)', () => {
    const days = initDayPlans(MON, 'steady');
    expect(days[0]!.dayOfWeek).toBe(1);
  });

  it('last day is Sunday (dayOfWeek = 0)', () => {
    const days = initDayPlans(MON, 'steady');
    expect(days[6]!.dayOfWeek).toBe(0);
  });

  it('all days start with 0 tasks and 0 fatigue', () => {
    const days = initDayPlans(MON, 'steady');
    for (const d of days) {
      expect(d.tasks).toHaveLength(0);
      expect(d.fatigue).toBe(0);
      expect(d.totalMinutes).toBe(0);
    }
  });

  it('assigns correct budgets for thorough preference', () => {
    const days = initDayPlans(MON, 'thorough');
    const monday   = days.find((d) => d.dayOfWeek === 1)!;
    const saturday = days.find((d) => d.dayOfWeek === 6)!;
    expect(monday.budget).toBe(55);
    expect(saturday.budget).toBe(105);
  });

  it('assigns correct budgets for quick preference', () => {
    const days = initDayPlans(MON, 'quick');
    const monday = days.find((d) => d.dayOfWeek === 1)!;
    expect(monday.budget).toBe(20);
  });

  it('dates are sequential from Monday', () => {
    const days = initDayPlans(MON, 'steady');
    for (let i = 1; i < days.length; i++) {
      const diff = days[i]!.date.getTime() - days[i - 1]!.date.getTime();
      expect(diff).toBe(24 * 60 * 60 * 1000); // 1 day in ms
    }
  });

  it('batch mode gives small weekday budget and large weekend budget', () => {
    const days = initDayPlans(MON, 'batch');
    const monday   = days.find((d) => d.dayOfWeek === 1)!;
    const saturday = days.find((d) => d.dayOfWeek === 6)!;
    expect(saturday.budget).toBeGreaterThan(monday.budget * 5);
  });
});

describe('canFit', () => {
  it('returns true when task fits in time and fatigue', () => {
    const day = makeDay(1, 60, 0);
    expect(canFit(day, makeScoredTask({ estimatedMinutes: 20, fatigueCost: 0.3 }))).toBe(true);
  });

  it('returns false when task exceeds budget', () => {
    const day = makeDay(1, 60, 0, 50); // 50 used of 60
    expect(canFit(day, makeScoredTask({ estimatedMinutes: 20 }))).toBe(false);
  });

  it('returns false when task exceeds fatigue threshold', () => {
    const day = makeDay(1, 120, 2.4); // near weekday threshold (2.5)
    expect(canFit(day, makeScoredTask({ estimatedMinutes: 5, fatigueCost: 0.2 }))).toBe(false);
  });

  it('returns true exactly at budget boundary', () => {
    const day = makeDay(1, 60, 0, 40); // 40 used of 60
    expect(canFit(day, makeScoredTask({ estimatedMinutes: 20 }))).toBe(true);
  });

  it('returns false when budget is 0 (no-go day)', () => {
    const day = makeDay(1, 0, 0, 0);
    expect(canFit(day, makeScoredTask({ estimatedMinutes: 5 }))).toBe(false);
  });
});

describe('placeTask', () => {
  it('adds task to day and updates totals', () => {
    const day = makeDay(1);
    const scored = makeScoredTask({ estimatedMinutes: 20, fatigueCost: 0.4 });
    placeTask(day, scored);
    expect(day.tasks).toHaveLength(1);
    expect(day.totalMinutes).toBe(20);
    expect(day.fatigue).toBeCloseTo(0.4);
  });

  it('accumulates on repeated calls', () => {
    const day = makeDay(1);
    placeTask(day, makeScoredTask({ id: 't1', estimatedMinutes: 10, fatigueCost: 0.2 }));
    placeTask(day, makeScoredTask({ id: 't2', estimatedMinutes: 15, fatigueCost: 0.3 }));
    expect(day.tasks).toHaveLength(2);
    expect(day.totalMinutes).toBe(25);
    expect(day.fatigue).toBeCloseTo(0.5);
  });

  it('records the task zone on the ScheduledTask', () => {
    const day = makeDay(1);
    const scored = makeScoredTask({ zone: 'kitchen', estimatedMinutes: 10, fatigueCost: 0.2 });
    placeTask(day, scored);
    expect(day.tasks[0]!.zone).toBe('kitchen');
  });
});

describe('findBestDay', () => {
  it('returns -1 when no day can fit the task', () => {
    const days = [makeDay(1, 10, 0, 9)]; // only 1 min remaining
    expect(findBestDay(days, makeScoredTask({ estimatedMinutes: 20 }))).toBe(-1);
  });

  it('returns the index of a fitting day', () => {
    const days = [makeDay(1, 60)];
    expect(findBestDay(days, makeScoredTask({ estimatedMinutes: 20 }))).toBe(0);
  });

  it('prefers the day with more remaining budget', () => {
    const days = [
      makeDay(1, 60, 0, 30), // 30 remaining
      makeDay(2, 60, 0, 10), // 50 remaining ← should win
    ];
    expect(findBestDay(days, makeScoredTask({ estimatedMinutes: 20 }))).toBe(1);
  });

  it('skips days where task does not fit', () => {
    const days = [
      makeDay(1, 15, 0, 10), // 5 remaining — too small
      makeDay(2, 60, 0, 0),  // 60 remaining ← wins
    ];
    expect(findBestDay(days, makeScoredTask({ estimatedMinutes: 20 }))).toBe(1);
  });
});

describe('findBestWeekendDay', () => {
  it('places task on Saturday when available', () => {
    const days = [
      makeDay(1, 60),   // Monday — should be ignored
      makeDay(6, 120),  // Saturday ← index 1
    ];
    expect(findBestWeekendDay(days, makeScoredTask({ estimatedMinutes: 30 }))).toBe(1);
  });

  it('places task on Sunday when Saturday is full', () => {
    const days = [
      makeDay(6, 20, 0, 20), // Saturday full
      makeDay(0, 90, 0, 0),  // Sunday ← index 1
    ];
    expect(findBestWeekendDay(days, makeScoredTask({ estimatedMinutes: 30 }))).toBe(1);
  });

  it('returns -1 when both weekend days are full', () => {
    const days = [
      makeDay(6, 30, 0, 30), // Saturday full
      makeDay(0, 30, 0, 30), // Sunday full
    ];
    expect(findBestWeekendDay(days, makeScoredTask({ estimatedMinutes: 30 }))).toBe(-1);
  });

  it('ignores weekday slots', () => {
    const days = [
      makeDay(1, 120),       // Monday — lots of room, ignored
      makeDay(6, 10, 0, 10), // Saturday full
      makeDay(0, 10, 0, 10), // Sunday full
    ];
    expect(findBestWeekendDay(days, makeScoredTask({ estimatedMinutes: 30 }))).toBe(-1);
  });

  it('prefers Saturday over Sunday when both have room', () => {
    const days = [
      makeDay(0, 90, 0, 0),  // Sunday — index 0, 90 remaining
      makeDay(6, 120, 0, 0), // Saturday — index 1, 120 remaining ← more room
    ];
    // Both fit; Saturday has more remaining budget so should win
    expect(findBestWeekendDay(days, makeScoredTask({ estimatedMinutes: 30 }))).toBe(1);
  });
});
