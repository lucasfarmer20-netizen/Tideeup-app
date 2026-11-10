/**
 * Household profile (quiz v2) — turns the richer intake answers into the
 * numbers the rest of the engine already understands.
 *
 * Everything here degrades gracefully: when a profile field is missing the
 * function returns the value the coarse inputs would have produced, so
 * pre-v2 callers see no change.
 */

import type { HouseholdProfile, KidAges, PlannerInput, TimeDistribution, Zone } from './types.js';
import { getDayBudget } from './budgeter.js';

// ─── Kids ─────────────────────────────────────────────────────────────────────
//
// Chaos per child by age band. Under-5s make the most mess per head; teens
// make little and (later, via member assignment) become capacity.

const KID_CHAOS: Record<keyof KidAges, number> = {
  under5:   1.0,
  age5to12: 0.6,
  teen:     0.25,
};

export function totalKids(kidAges: KidAges | undefined): number {
  if (!kidAges) return 0;
  return kidAges.under5 + kidAges.age5to12 + kidAges.teen;
}

/**
 * 0–1.5: how much the kids in this home inflate mess. The legacy `kids: true`
 * equals one 5–12-year-old (0.6). Diminishing returns past two kids.
 */
export function kidChaosLevel(input: Pick<PlannerInput, 'kids' | 'profile'>): number {
  const ages = input.profile?.kidAges;
  if (!ages) return input.kids ? KID_CHAOS.age5to12 : 0;
  const raw =
    ages.under5 * KID_CHAOS.under5 +
    ages.age5to12 * KID_CHAOS.age5to12 +
    ages.teen * KID_CHAOS.teen;
  // Soft cap: 1 - e^(-raw) scaled so one 5–12 kid ≈ 0.6, three under-5s ≈ 1.4
  return Math.round(Math.min(1.5, 1.5 * (1 - Math.exp(-raw / 1.2))) * 100) / 100;
}

/** True when there are any kids, from either representation. */
export function hasKids(input: Pick<PlannerInput, 'kids' | 'profile'>): boolean {
  const ages = input.profile?.kidAges;
  return ages ? totalKids(ages) > 0 : input.kids;
}

/** Effective people count for shared-space scaling. */
export function effectiveHouseholdCount(input: Pick<PlannerInput, 'householdCount' | 'profile'>): number {
  const p = input.profile;
  if (p?.adults !== undefined) {
    return Math.max(1, Math.min(6, p.adults + totalKids(p.kidAges)));
  }
  return input.householdCount;
}

// ─── Rooms ────────────────────────────────────────────────────────────────────
//
// Bathrooms scale bathroom-zone minutes linearly past the first; floors add a
// modest overhead to floor-cleaning tasks (stairs, carrying the vacuum).

export function zoneMinuteMultiplier(zone: Zone, task: { tags: string[] }, profile: HouseholdProfile | undefined): number {
  let m = 1;
  if (profile?.bathrooms !== undefined && zone === 'bathroom') {
    // 1 bath → 1.0, 2 → 1.6, 3 → 2.2, 4+ → 2.8 (shared supplies + travel save a little)
    m *= 1 + 0.6 * (Math.max(1, Math.min(4, profile.bathrooms)) - 1);
  }
  if (profile?.floors === 2 && task.tags.includes('floors')) {
    m *= 1.2;
  }
  return m;
}

// ─── Time ─────────────────────────────────────────────────────────────────────
//
// Weekly hours + distribution → seven day budgets (Monday first). These are
// the defaults the Pro "Your week" sliders open with; the free tier uses them
// directly.

const DISTRIBUTION_WEIGHTS: Record<TimeDistribution, number[]> = {
  // Original ratios scaled by 10 so remainder comparisons use exact integers.
  // Mon  Tue  Wed  Thu  Fri  Sat  Sun
  spread:   [10, 10, 10, 10, 10, 13, 12],
  weekends: [4, 4, 4, 4, 4, 26, 20],
  weekdays: [13, 13, 13, 13, 13, 6, 6],
};

const DOW_MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;
const MINUTES_PER_UNIT = 5;
const MAX_DAY_MINUTES = 180;
const MAX_DAY_UNITS = MAX_DAY_MINUTES / MINUTES_PER_UNIT;

/** Capped largest-remainder apportionment; ties go to the earlier weekday. */
function allocateWeeklyBudget(weeklyHours: number, weights: number[]): number[] {
  // Clamp before multiplying to avoid overflow for huge finite inputs. Round
  // only the weekly total: nearest five minutes, with half units rounded up.
  const capacityHours = weights.length * MAX_DAY_MINUTES / 60;
  let remaining = Math.round(Math.min(weeklyHours, capacityHours) * (60 / MINUTES_PER_UNIT));
  const days = weights.map((weight, index) => ({ weight, index, units: 0 }));
  let active = days;

  while (remaining > 0 && active.length > 0) {
    const totalWeight = active.reduce((sum, day) => sum + day.weight, 0);
    const capped = active.filter((day) => remaining * day.weight >= MAX_DAY_UNITS * totalWeight);
    if (capped.length > 0) {
      for (const day of capped) day.units = MAX_DAY_UNITS;
      remaining -= capped.length * MAX_DAY_UNITS;
      // Recompute the shares among uncapped days; none of the excess is lost.
      active = active.filter((day) => day.units < MAX_DAY_UNITS);
      continue;
    }

    const shares = active.map((day) => ({
      day,
      units: Math.floor(remaining * day.weight / totalWeight),
      remainder: remaining * day.weight % totalWeight,
    }));
    for (const share of shares) {
      share.day.units = share.units;
      remaining -= share.units;
    }
    shares.sort((a, b) => b.remainder - a.remainder || a.day.index - b.day.index);
    for (const { day } of shares) {
      if (remaining === 0) break;
      day.units += 1;
      remaining -= 1;
    }
  }

  return days.map((day) => day.units * MINUTES_PER_UNIT);
}

/**
 * Seven Monday-first day budgets. Prefers, in order: explicit `dayBudgets`,
 * the profile's weekly hours + distribution, then the timePreference table.
 * Zero hours means zero supply. Invalid (negative/non-finite) weekly hours
 * use the legacy table. Explicit day budgets keep their existing semantics.
 */
export function deriveDayBudgets(
  input: Pick<PlannerInput, 'timePreference' | 'dayBudgets' | 'profile'>,
): number[] {
  if (input.dayBudgets && input.dayBudgets.length === 7) {
    return input.dayBudgets.map((m) => Math.max(0, Math.round(m)));
  }
  const p = input.profile;
  if (p?.weeklyHours !== undefined && Number.isFinite(p.weeklyHours) && p.weeklyHours >= 0) {
    const weights = DISTRIBUTION_WEIGHTS[p.distribution ?? 'spread'];
    return allocateWeeklyBudget(p.weeklyHours, weights);
  }
  return DOW_MONDAY_FIRST.map((dow) => getDayBudget(dow, input.timePreference));
}
