import { describe, it, expect } from 'vitest';
import { scoreTask, scoreAndSort, isEligibleForHousehold } from '../scorer.js';
import { TASK_LIBRARY } from '../../tasks/library.js';
import type { FlooringType, HomeType, PetType, Task } from '../types.js';

const BASE_INPUT = {
  homeSize: 'M' as const,
  householdCount: 2,
  petTypes: [] as PetType[],
  kids: false,
  flooringTypes: ['hardwood', 'carpet'] as FlooringType[],
  homeType: 'single-family' as HomeType,
};

const dishes         = TASK_LIBRARY.find((t) => t.id === 'dishes')!;
const laundryWash    = TASK_LIBRARY.find((t) => t.id === 'laundry-wash-dry')!;
const deepCleanOven  = TASK_LIBRARY.find((t) => t.id === 'deep-clean-oven')!;
const vacuumCarpet   = TASK_LIBRARY.find((t) => t.id === 'vacuum-carpet-living')!;
const litterScoop    = TASK_LIBRARY.find((t) => t.id === 'litter-box-scoop')!;
const mopKitchen     = TASK_LIBRARY.find((t) => t.id === 'mop-kitchen-floor')!;
const mowLawn        = TASK_LIBRARY.find((t) => t.id === 'mow-lawn')!;
const rakeLeaves     = TASK_LIBRARY.find((t) => t.id === 'rake-leaves')!;
const littleBoxFull  = TASK_LIBRARY.find((t) => t.id === 'litter-box-full-clean')!;

describe('scoreTask', () => {
  it('daily tasks score higher than weekly tasks', () => {
    const daily  = scoreTask(dishes, BASE_INPUT, 'spring');
    const weekly = scoreTask(laundryWash, BASE_INPUT, 'spring');
    expect(daily.score).toBeGreaterThan(weekly.score);
  });

  it('weekly tasks score higher than monthly tasks', () => {
    const weekly  = scoreTask(laundryWash, BASE_INPUT, 'spring');
    const monthly = scoreTask(deepCleanOven, BASE_INPUT, 'spring');
    expect(weekly.score).toBeGreaterThan(monthly.score);
  });

  it('XL home scores higher than S home', () => {
    const xl = scoreTask(dishes, { ...BASE_INPUT, homeSize: 'XL' }, 'spring');
    const s  = scoreTask(dishes, { ...BASE_INPUT, homeSize: 'S'  }, 'spring');
    expect(xl.score).toBeGreaterThan(s.score);
  });

  it('larger household increases score', () => {
    const big   = scoreTask(dishes, { ...BASE_INPUT, householdCount: 6 }, 'spring');
    const small = scoreTask(dishes, { ...BASE_INPUT, householdCount: 1 }, 'spring');
    expect(big.score).toBeGreaterThan(small.score);
  });

  it('pets boost score on tasks with petBoost', () => {
    const withPets = scoreTask(vacuumCarpet, { ...BASE_INPUT, petTypes: ['large-dog-1-2'] }, 'spring');
    const noPets   = scoreTask(vacuumCarpet, { ...BASE_INPUT, petTypes: []               }, 'spring');
    expect(withPets.score).toBeGreaterThan(noPets.score);
  });

  it('kids boost score on tasks with kidsBoost', () => {
    const withKids = scoreTask(dishes, { ...BASE_INPUT, kids: true  }, 'spring');
    const noKids   = scoreTask(dishes, { ...BASE_INPUT, kids: false }, 'spring');
    expect(withKids.score).toBeGreaterThan(noKids.score);
  });

  it('XL home has longer estimated minutes than S home', () => {
    const xl = scoreTask(dishes, { ...BASE_INPUT, homeSize: 'XL' }, 'spring');
    const s  = scoreTask(dishes, { ...BASE_INPUT, homeSize: 'S'  }, 'spring');
    expect(xl.estimatedMinutes).toBeGreaterThan(s.estimatedMinutes);
  });

  it('estimated minutes use typicalMinutes[homeSize] as base', () => {
    const result = scoreTask(dishes, BASE_INPUT, 'spring');
    expect(result.estimatedMinutes).toBe(dishes.typicalMinutes['M']);
  });

  it('petBoost adds minutes when pets are present', () => {
    const withPets = scoreTask(vacuumCarpet, { ...BASE_INPUT, petTypes: ['cat-1-2'] }, 'spring');
    const noPets   = scoreTask(vacuumCarpet, { ...BASE_INPUT, petTypes: []          }, 'spring');
    expect(withPets.estimatedMinutes).toBeGreaterThan(noPets.estimatedMinutes);
  });

  it('6+ household adds 1.4x on shared-space tasks', () => {
    const large  = scoreTask(dishes, { ...BASE_INPUT, householdCount: 6 }, 'spring');
    const normal = scoreTask(dishes, { ...BASE_INPUT, householdCount: 3 }, 'spring');
    // dishes is kitchen (shared), so 6-household should be longer
    expect(large.estimatedMinutes).toBeGreaterThan(normal.estimatedMinutes);
  });

  it('6+ household does NOT add multiplier on bedroom tasks', () => {
    const bedroomTask = TASK_LIBRARY.find((t) => t.id === 'dust-bedroom-surfaces')!;
    const large  = scoreTask(bedroomTask, { ...BASE_INPUT, householdCount: 6 }, 'spring');
    const normal = scoreTask(bedroomTask, { ...BASE_INPUT, householdCount: 3 }, 'spring');
    // Bedroom is not a shared zone — minutes should be equal (no kids/pet boost)
    expect(large.estimatedMinutes).toBe(normal.estimatedMinutes);
  });

  it('returns a positive score', () => {
    const result = scoreTask(dishes, BASE_INPUT, 'winter');
    expect(result.score).toBeGreaterThan(0);
  });

  it('larger cat household has higher chaos for litter tasks than smaller', () => {
    const many = scoreTask(litterScoop, { ...BASE_INPUT, petTypes: ['cat-3-plus'] }, 'spring');
    const few  = scoreTask(litterScoop, { ...BASE_INPUT, petTypes: ['cat-1-2']    }, 'spring');
    expect(many.score).toBeGreaterThan(few.score);
  });
});

describe('isEligibleForHousehold', () => {
  it('cat-only task is eligible for cat households', () => {
    expect(
      isEligibleForHousehold(litterScoop, ['cat-1-2'], ['hardwood'], 'single-family', 6),
    ).toBe(true);
  });

  it('cat-only task is NOT eligible when no cats', () => {
    expect(
      isEligibleForHousehold(litterScoop, [], ['hardwood'], 'single-family', 6),
    ).toBe(false);
  });

  it('cat-only task is NOT eligible for dog-only households', () => {
    expect(
      isEligibleForHousehold(litterScoop, ['large-dog-1-2'], ['hardwood'], 'single-family', 6),
    ).toBe(false);
  });

  it('flooring-restricted task passes for matching flooring', () => {
    expect(
      isEligibleForHousehold(mopKitchen, [], ['tile'], 'single-family', 6),
    ).toBe(true);
  });

  it('flooring-restricted task fails for non-matching flooring', () => {
    expect(
      isEligibleForHousehold(mopKitchen, [], ['carpet'], 'single-family', 6),
    ).toBe(false);
  });

  it('homeType-restricted task fails for apartment', () => {
    expect(
      isEligibleForHousehold(mowLawn, [], ['hardwood'], 'apartment', 5),
    ).toBe(false);
  });

  it('homeType-restricted task passes for single-family', () => {
    expect(
      isEligibleForHousehold(mowLawn, [], ['hardwood'], 'single-family', 5),
    ).toBe(true);
  });

  it('seasonal task passes in matching month', () => {
    // rake-leaves is months 10-12
    expect(
      isEligibleForHousehold(rakeLeaves, [], ['hardwood'], 'single-family', 11),
    ).toBe(true);
  });

  it('seasonal task fails outside its months', () => {
    expect(
      isEligibleForHousehold(rakeLeaves, [], ['hardwood'], 'single-family', 6),
    ).toBe(false);
  });

  it('universal task (all nulls) passes any household', () => {
    expect(
      isEligibleForHousehold(dishes, [], ['carpet'], 'apartment', 6),
    ).toBe(true);
  });
});

describe('scoreAndSort', () => {
  it('returns tasks in descending score order', () => {
    const results = scoreAndSort(TASK_LIBRARY, BASE_INPUT, 'spring', 6);
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i]!.score).toBeGreaterThanOrEqual(results[i + 1]!.score);
    }
  });

  it('filters out cat-specific tasks when petTypes is empty', () => {
    const results = scoreAndSort(TASK_LIBRARY, { ...BASE_INPUT, petTypes: [] }, 'spring', 6);
    const hasCatTask = results.some((r) => r.task.id === 'litter-box-scoop');
    expect(hasCatTask).toBe(false);
  });

  it('includes cat tasks when petTypes includes cats', () => {
    const results = scoreAndSort(
      TASK_LIBRARY,
      { ...BASE_INPUT, petTypes: ['cat-1-2'] },
      'spring',
      6,
    );
    const hasCatTask = results.some((r) => r.task.id === 'litter-box-scoop');
    expect(hasCatTask).toBe(true);
  });

  it('filters out carpet tasks when household has no carpet', () => {
    const results = scoreAndSort(
      TASK_LIBRARY,
      { ...BASE_INPUT, flooringTypes: ['tile'] },
      'spring',
      6,
    );
    const hasCarpetTask = results.some((r) => r.task.id === 'vacuum-carpet-living');
    expect(hasCarpetTask).toBe(false);
  });

  it('includes carpet tasks when household has carpet', () => {
    const results = scoreAndSort(
      TASK_LIBRARY,
      { ...BASE_INPUT, flooringTypes: ['carpet'] },
      'spring',
      6,
    );
    const hasCarpetTask = results.some((r) => r.task.id === 'vacuum-carpet-living');
    expect(hasCarpetTask).toBe(true);
  });

  it('filters out outdoor tasks for apartments', () => {
    const results = scoreAndSort(
      TASK_LIBRARY,
      { ...BASE_INPUT, homeType: 'apartment' },
      'spring',
      5,
    );
    const hasMowLawn = results.some((r) => r.task.id === 'mow-lawn');
    expect(hasMowLawn).toBe(false);
  });

  it('filters out seasonal tasks outside their months', () => {
    // mow-lawn is April–October (months 4–10). Month 2 = February → excluded.
    const results = scoreAndSort(TASK_LIBRARY, BASE_INPUT, 'winter', 2);
    const hasMowLawn = results.some((r) => r.task.id === 'mow-lawn');
    expect(hasMowLawn).toBe(false);
  });

  it('includes seasonal tasks in their active months', () => {
    // mow-lawn active in month 5 (May)
    const results = scoreAndSort(TASK_LIBRARY, BASE_INPUT, 'spring', 5);
    const hasMowLawn = results.some((r) => r.task.id === 'mow-lawn');
    expect(hasMowLawn).toBe(true);
  });

  it('returns only universal tasks when no pets, carpet-only home, apartment in off-season', () => {
    const results = scoreAndSort(
      TASK_LIBRARY,
      { ...BASE_INPUT, petTypes: [], flooringTypes: ['carpet'], homeType: 'apartment' },
      'winter',
      1,
    );
    // All returned tasks must have null petTypes, null homeTypes, and non-seasonal or winter months
    for (const r of results) {
      expect(r.task.petTypes).toBeNull();
      if (r.task.homeTypes !== null) {
        expect(r.task.homeTypes).toContain('apartment');
      }
    }
  });
});
