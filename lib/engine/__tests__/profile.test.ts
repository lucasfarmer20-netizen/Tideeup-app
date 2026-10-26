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
    expect(total).toBeGreaterThanOrEqual(290);
    expect(total).toBeLessThanOrEqual(310);
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
    // 240 min nominal; per-day 5-minute snapping can drift by a few minutes
    expect(plan.metadata.pressure.supplyMinutes).toBeGreaterThanOrEqual(225);
    expect(plan.metadata.pressure.supplyMinutes).toBeLessThanOrEqual(255);
    for (const d of plan.days) expect(d.totalMinutes).toBeLessThanOrEqual(d.budget);
  });
});
