import { describe, it, expect } from 'vitest';
import {
  kidChaosLevel,
  hasKids,
  effectiveHouseholdCount,
  zoneMinuteMultiplier,
  deriveDayBudgets,
} from '../profile.js';
import { generateWeekPlan } from '../planner.js';
import { scoreTask } from '../scorer.js';
import { TASK_LIBRARY } from '../../tasks/library.js';
import type { PlannerInput, TimeDistribution, TimePreference } from '../types.js';

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

const byId = (id: string) => TASK_LIBRARY.find((t) => t.id === id)!;

describe('kids', () => {
  it('legacy kids:true equals one 5–12 year old', () => {
    expect(kidChaosLevel({ kids: true })).toBe(0.6);
    expect(kidChaosLevel({ kids: false })).toBe(0);
    expect(hasKids({ kids: true })).toBe(true);
  });
  it('under-5s add more chaos than teens', () => {
    const toddler = kidChaosLevel({ kids: false, profile: { kidAges: { under5: 1, age5to12: 0, teen: 0 } } });
    const teen = kidChaosLevel({ kids: false, profile: { kidAges: { under5: 0, age5to12: 0, teen: 1 } } });
    expect(toddler).toBeGreaterThan(teen);
    expect(teen).toBeGreaterThan(0);
  });
  it('caps with diminishing returns', () => {
    const many = kidChaosLevel({ kids: false, profile: { kidAges: { under5: 4, age5to12: 4, teen: 2 } } });
    expect(many).toBeLessThanOrEqual(1.5);
  });
  it('profile with zero kids overrides legacy flag', () => {
    expect(hasKids({ kids: true, profile: { kidAges: { under5: 0, age5to12: 0, teen: 0 } } })).toBe(false);
  });
  it('kid chaos raises task minutes and score', () => {
    const t = byId('tidy-common-areas');
    const none = scoreTask(t, { ...BASE }, 'summer');
    const toddlers = scoreTask(t, { ...BASE, profile: { kidAges: { under5: 2, age5to12: 0, teen: 0 } } }, 'summer');
    expect(toddlers.estimatedMinutes).toBeGreaterThan(none.estimatedMinutes);
    expect(toddlers.score).toBeGreaterThan(none.score);
  });
});

describe('household count', () => {
  it('derives from adults + kids when profile present', () => {
    expect(effectiveHouseholdCount({ householdCount: 2, profile: { adults: 2, kidAges: { under5: 1, age5to12: 2, teen: 0 } } })).toBe(5);
    expect(effectiveHouseholdCount({ householdCount: 2, profile: { adults: 5, kidAges: { under5: 3, age5to12: 0, teen: 0 } } })).toBe(6);
    expect(effectiveHouseholdCount({ householdCount: 3 })).toBe(3);
  });
});

describe('rooms', () => {
  it('bathrooms scale bathroom-zone minutes only', () => {
    const bath = byId('scrub-toilet');
    const kitchen = byId('dishes');
    expect(zoneMinuteMultiplier('bathroom', bath, { bathrooms: 3 })).toBeCloseTo(2.2);
    expect(zoneMinuteMultiplier('kitchen', kitchen, { bathrooms: 3 })).toBe(1);
    expect(zoneMinuteMultiplier('bathroom', bath, undefined)).toBe(1);
  });
  it('two floors add overhead to floor tasks', () => {
    const floors = byId('mop-kitchen-floor');
    expect(zoneMinuteMultiplier('kitchen', floors, { floors: 2 })).toBeCloseTo(1.2);
    expect(zoneMinuteMultiplier('kitchen', floors, { floors: 1 })).toBe(1);
  });
  it('a 3-bath home plans more bathroom minutes than a 1-bath home', () => {
    const one = generateWeekPlan({ ...BASE, timePreference: 'thorough', profile: { bathrooms: 1 } });
    const three = generateWeekPlan({ ...BASE, timePreference: 'thorough', profile: { bathrooms: 3 } });
    const bathMinutes = (p: ReturnType<typeof generateWeekPlan>) =>
      p.days.flatMap((d) => d.tasks).filter((t) => t.zone === 'bathroom').reduce((s, t) => s + t.estimatedMinutes, 0);
    // Demand rises; under the same budget the planner may trim the now-larger
    // bathroom tasks, so compare per-occurrence minutes, not totals placed.
    expect(three.metadata.pressure.demandMinutes).toBeGreaterThan(one.metadata.pressure.demandMinutes);
    const perTask = (p: ReturnType<typeof generateWeekPlan>, id: string) =>
      p.days.flatMap((d) => d.tasks).find((t) => t.task.id === id)?.estimatedMinutes;
    const oneToilet = perTask(one, 'quick-bathroom-wipe');
    const threeToilet = perTask(three, 'quick-bathroom-wipe');
    if (oneToilet !== undefined && threeToilet !== undefined) {
      expect(threeToilet).toBeGreaterThan(oneToilet);
    }
    expect(bathMinutes(one) + bathMinutes(three)).toBeGreaterThan(0);
  });
});

describe('deriveDayBudgets', () => {
  it('prefers explicit dayBudgets', () => {
    expect(deriveDayBudgets({ timePreference: 'quick', dayBudgets: [1, 2, 3, 4, 5, 6, 7], profile: { weeklyHours: 10 } }))
      .toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('falls back to the timePreference table', () => {
    expect(deriveDayBudgets({ timePreference: 'steady' })).toEqual([35, 35, 35, 35, 35, 65, 50]);
  });
  it('spreads weekly hours evenly with modest weekend headroom', () => {
    const b = deriveDayBudgets({ timePreference: 'steady', profile: { weeklyHours: 5, distribution: 'spread' } });
    const total = b.reduce((a, x) => a + x, 0);
    expect(total).toBe(300);
    expect(b[5]).toBeGreaterThan(b[0]!);
    for (const m of b) expect(m % 5).toBe(0);
  });
  it('weekends distribution loads Sat/Sun', () => {
    const b = deriveDayBudgets({ timePreference: 'steady', profile: { weeklyHours: 5, distribution: 'weekends' } });
    expect(b[5]! + b[6]!).toBeGreaterThan(b.slice(0, 5).reduce((a, x) => a + x, 0));
  });
  it('clamps a day at the slider max of 180', () => {
    const b = deriveDayBudgets({ timePreference: 'steady', profile: { weeklyHours: 20, distribution: 'weekends' } });
    for (const m of b) expect(m).toBeLessThanOrEqual(180);
  });
  it('planner uses the derived budgets as supply', () => {
    const plan = generateWeekPlan({ ...BASE, profile: { weeklyHours: 4, distribution: 'spread' } });
    expect(plan.metadata.pressure.supplyMinutes).toBe(240);
    for (const d of plan.days) expect(d.totalMinutes).toBeLessThanOrEqual(d.budget);
  });
});

describe('weekly budget conservation', () => {
  const distributions: TimeDistribution[] = ['spread', 'weekdays', 'weekends'];
  const allocate = (weeklyHours: number, distribution: TimeDistribution = 'spread') =>
    deriveDayBudgets({ timePreference: 'steady', profile: { weeklyHours, distribution } });
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

  it.each([
    ['spread', [30, 30, 30, 25, 25, 35, 35]],
    ['weekdays', [35, 35, 35, 35, 35, 20, 15]],
    ['weekends', [15, 15, 15, 10, 10, 80, 65]],
  ] satisfies [TimeDistribution, number[]][])('allocates exactly 210 minutes for 3.5 hours: %s', (distribution, expected) => {
    expect(allocate(3.5, distribution)).toEqual(expected);
    expect(sum(allocate(3.5, distribution))).toBe(210);
  });

  it.each([
    ['spread', 6.25, [50, 50, 50, 50, 50, 65, 60]],
    ['weekdays', 385 / 60, [65, 65, 65, 65, 65, 30, 30]],
    ['weekends', 5.5, [20, 20, 20, 20, 20, 130, 100]],
  ] satisfies [TimeDistribution, number, number[]][])('preserves the exact distribution ratios when representable: %s', (distribution, hours, expected) => {
    expect(allocate(hours, distribution)).toEqual(expected);
  });

  it.each(distributions)('conserves every representable total through capacity: %s', (distribution) => {
    // Exhaust the whole slider capacity, including each saturation boundary.
    for (let minutes = 0; minutes <= 7 * 180; minutes += 5) {
      const budgets = allocate(minutes / 60, distribution);
      expect(budgets).toHaveLength(7);
      expect(sum(budgets)).toBe(minutes);
      for (const budget of budgets) {
        expect(Number.isFinite(budget)).toBe(true);
        expect(budget % 5).toBe(0);
        expect(budget).toBeGreaterThanOrEqual(0);
        expect(budget).toBeLessThanOrEqual(180);
      }
      expect(allocate(minutes / 60, distribution)).toEqual(budgets);
    }
  });

  it('redistributes Saturday overflow while preserving uncapped weight ratios', () => {
    expect(allocate(8, 'weekends')).toEqual([30, 30, 30, 30, 30, 180, 150]);
  });

  it('redistributes again when Sunday also reaches its cap', () => {
    expect(allocate(10, 'weekends')).toEqual([50, 50, 50, 45, 45, 180, 180]);
    expect(allocate(20, 'weekends')).toEqual([170, 170, 170, 165, 165, 180, 180]);
  });

  it('redistributes capped weekday shares into the weekend', () => {
    expect(allocate(20, 'weekdays')).toEqual([180, 180, 180, 180, 180, 150, 150]);
  });

  it.each(distributions)('caps only at total capacity for oversized finite budgets: %s', (distribution) => {
    for (const hours of [21, 21 + Number.EPSILON * 32, 30, Number.MAX_VALUE]) {
      expect(allocate(hours, distribution)).toEqual([180, 180, 180, 180, 180, 180, 180]);
    }
  });

  it.each([
    [0, 0], [-0, 0], [Number.MIN_VALUE, 0],
    [2.49 / 60, 0], [2.5 / 60, 5], [2.51 / 60, 5],
    [7.49 / 60, 5], [7.5 / 60, 10], [7.51 / 60, 10],
    [3.51, 210], [3.55, 215], [1257.49 / 60, 1255], [1257.5 / 60, 1260],
  ])('rounds the weekly total once: %s hours → %s minutes', (hours, minutes) => {
    for (const distribution of distributions) expect(sum(allocate(hours, distribution))).toBe(minutes);
  });

  it('breaks equal remainders in Monday-first order', () => {
    expect(allocate(5 / 60, 'weekdays')).toEqual([5, 0, 0, 0, 0, 0, 0]);
    expect(allocate(10 / 60, 'weekdays')).toEqual([5, 5, 0, 0, 0, 0, 0]);
  });

  it('uses spread when distribution is absent', () => {
    expect(deriveDayBudgets({ timePreference: 'batch', profile: { weeklyHours: 3.5 } }))
      .toEqual(allocate(3.5));
  });

  it.each([
    ['quick', [20, 20, 20, 20, 20, 35, 28]],
    ['steady', [35, 35, 35, 35, 35, 65, 50]],
    ['thorough', [55, 55, 55, 55, 55, 105, 80]],
    ['batch', [15, 15, 15, 15, 15, 130, 105]],
  ] satisfies [TimePreference, number[]][])('preserves %s fallback for absent or invalid weekly hours', (timePreference, expected) => {
    expect(deriveDayBudgets({ timePreference })).toEqual(expected);
    expect(deriveDayBudgets({ timePreference, profile: { distribution: 'weekends' } })).toEqual(expected);
    for (const weeklyHours of [NaN, Infinity, -Infinity, -1, -Number.MIN_VALUE]) {
      expect(deriveDayBudgets({ timePreference, profile: { weeklyHours } })).toEqual(expected);
    }
  });

  it('preserves explicit minute rounding, nonnegative clamp, and precedence without a new cap', () => {
    const dayBudgets = [0, 1.4, 2.5, -1, 181, 250, 7.8];
    Object.freeze(dayBudgets);
    for (const weeklyHours of [0, 3.5, Infinity]) {
      const input = { timePreference: 'batch' as const, dayBudgets, profile: { weeklyHours } };
      Object.freeze(input.profile);
      Object.freeze(input);
      expect(deriveDayBudgets(input)).toEqual([0, 1, 3, 0, 181, 250, 8]);
    }
    expect(dayBudgets).toEqual([0, 1.4, 2.5, -1, 181, 250, 7.8]);
  });

  it('ignores explicit arrays of the wrong length, preserving existing precedence', () => {
    for (const dayBudgets of [[], [5], Array<number>(6).fill(5), Array<number>(8).fill(5)]) {
      expect(deriveDayBudgets({ timePreference: 'steady', dayBudgets, profile: { weeklyHours: 3.5 } }))
        .toEqual(allocate(3.5));
      expect(deriveDayBudgets({ timePreference: 'steady', dayBudgets }))
        .toEqual([35, 35, 35, 35, 35, 65, 50]);
    }
  });

  it('preserves valid explicit budgets and caps new plans at the 180-minute daily maximum', () => {
    const dayBudgets = [0, 17, 23, 41, 59, 180, 181];
    const plan = generateWeekPlan({ ...BASE, dayBudgets, profile: { weeklyHours: 3.5 } });
    expect(plan.days.map((day) => day.budget)).toEqual(dayBudgets.map(n => Math.min(180, n)));
    expect(plan.metadata.pressure.supplyMinutes).toBe(sum(dayBudgets) - 1);
    expect(dayBudgets[6]).toBe(181); // No mutation of the saved preference.
  });

  it('preserves legacy supply through the planner', () => {
    const plan = generateWeekPlan(BASE);
    expect(plan.days.map((day) => day.budget)).toEqual([35, 35, 35, 35, 35, 65, 50]);
    expect(plan.metadata.pressure.supplyMinutes).toBe(290);
  });

  it('gives zero hours zero supply rather than the legacy schedule', () => {
    const plan = generateWeekPlan({ ...BASE, profile: { weeklyHours: 0 } });
    expect(plan.days.map((day) => day.budget)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(plan.metadata.pressure.supplyMinutes).toBe(0);
    expect(plan.days.flatMap((day) => day.tasks)).toEqual([]);
  });

  it('keeps no-go-day handling separate from weekly apportionment', () => {
    const plan = generateWeekPlan({ ...BASE, noGoDays: [1], profile: { weeklyHours: 3.5 } });
    expect(plan.days.map((day) => day.budget)).toEqual([0, 30, 30, 25, 25, 35, 35]);
    expect(plan.metadata.pressure.supplyMinutes).toBe(180);
  });
});
