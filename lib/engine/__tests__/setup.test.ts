import { describe, expect, it } from 'vitest';
import { generateWeekPlan } from '../planner.js';
import { householdTasks } from '../household-work.js';
import { matchesPriority } from '../allocation.js';
import type { HouseholdSetup, PlannerInput } from '../types.js';

const family: PlannerInput = {
  homeSize: 'L', homeType: 'single-family', householdCount: 5, kids: true,
  petTypes: ['cat-1-2'], flooringTypes: ['carpet', 'hardwood'], timePreference: 'thorough',
  weekOf: new Date('2026-06-08T00:00:00.000Z'), priorities: [],
  profile: { adults: 2, kidAges: { under5: 1, age5to12: 2, teen: 0 }, bathrooms: 2, floors: 1, weeklyHours: 9, distribution: 'spread' },
};
const withSetup = (setup: HouseholdSetup): PlannerInput => ({ ...family, profile: { ...family.profile, setup } });
const task = (input: PlannerInput, id: string) => householdTasks(input).find(t => t.id === id);

describe('"Your setup" answers', () => {
  it('leaves an unanswered household on the default estimates', () => {
    expect(generateWeekPlan(family)).toEqual(generateWeekPlan(withSetup({})));
    expect(task(family, 'dishes')!.title).toBe('Wash dishes / run dishwasher');
  });

  it('roughly doubles dishes for hand washing and names the task for the answer', () => {
    const dishwasher = task(withSetup({ dishes: 'dishwasher' }), 'dishes')!;
    const hand = task(withSetup({ dishes: 'hand' }), 'dishes')!;
    expect(dishwasher.title).toBe('Unload and load the dishwasher');
    expect(dishwasher.work!.minutes).toBe(9);
    expect(hand.title).toBe('Wash dishes by hand');
    expect(hand.work!.minutes).toBe(18);
  });

  it('cuts routine floor runs to a quarter with a robot vacuum, but not mopping', () => {
    const before = task(family, 'vacuum-carpet-living')!.work!.minutes;
    const after = task(withSetup({ robotVacuum: true }), 'vacuum-carpet-living')!.work!.minutes;
    expect(after).toBe(Math.max(3, Math.round(before * 0.25)));
    expect(task(withSetup({ robotVacuum: true }), 'mop-hardwood-living')!.work!.minutes)
      .toBe(task(family, 'mop-hardwood-living')!.work!.minutes);
  });

  it('adds handling time for shared or laundromat laundry', () => {
    expect(task(family, 'laundry-wash-dry')!.work!.minutes).toBe(15);
    expect(task(withSetup({ laundry: 'shared' }), 'laundry-wash-dry')!.work!.minutes).toBe(20);
  });

  it('drops mowing only when the household says it has no lawn to mow', () => {
    expect(task(family, 'mow-lawn')).toBeDefined();
    expect(task(withSetup({ lawn: true }), 'mow-lawn')).toBeDefined();
    expect(task(withSetup({ lawn: false }), 'mow-lawn')).toBeUndefined();
  });
});

describe('duration calibration', () => {
  it('plans laundry per load, scaled by people, as one wash-to-put-away task', () => {
    const single = task({ ...family, householdCount: 1, kids: false, profile: { adults: 1, weeklyHours: 9 } }, 'laundry-wash-dry')!;
    const five = task(family, 'laundry-wash-dry')!;
    expect(single.cadence).toEqual({ target: 1, min: 1 });
    expect(five.cadence).toEqual({ target: 6, min: 1 });
    expect(task(family, 'laundry-fold-put-away')).toBeUndefined();
    expect(householdTasks(family).some(t => t.work?.alternativeFor?.startsWith('laundry'))).toBe(false);
  });

  it('lets kid mess add more to tidying than to other tasks', () => {
    const noKids: PlannerInput = { ...family, householdCount: 2, kids: false, profile: { adults: 2, weeklyHours: 9 } };
    const base = task(noKids, 'tidy-common-areas')!.work!.minutes;
    expect(task(family, 'tidy-common-areas')!.work!.minutes).toBeGreaterThan(Math.round(base * 1.35));
  });

  it('keeps at least one tidy in a tight week with kids', () => {
    const tight: PlannerInput = { ...family, priorities: ['kitchen-reset', 'floors'], profile: { ...family.profile, weeklyHours: 3.5, distribution: 'weekends' } };
    const plan = generateWeekPlan(tight);
    expect(plan.days.flatMap(d => d.tasks).some(t => t.task.id === 'tidy-common-areas')).toBe(true);
  });

  it('folds the lint trap and cat bowls into neighbouring tasks', () => {
    expect(task(family, 'dryer-lint-trap')).toBeUndefined();
    expect(task(family, 'cat-food-water-bowls')).toBeUndefined();
    expect(task(family, 'litter-box-scoop')!.title).toBe('Scoop litter box and refresh cat bowls');
  });

  it('treats the stovetop deep clean as monthly and outside priority boosts', () => {
    const stovetop = task(family, 'deep-clean-stovetop')!;
    expect(stovetop.frequency).toBe('monthly');
    expect(matchesPriority(stovetop, ['kitchen-reset'])).toBe(false);
    expect(matchesPriority(task(family, 'wipe-kitchen-counters')!, ['kitchen-reset'])).toBe(true);
  });
});
