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
  // Mon  Tue  Wed  Thu  Fri  Sat  Sun
  spread:   [1.0, 1.0, 1.0, 1.0, 1.0, 1.3, 1.2],
  weekends: [0.4, 0.4, 0.4, 0.4, 0.4, 2.6, 2.0],
  weekdays: [1.3, 1.3, 1.3, 1.3, 1.3, 0.6, 0.6],
};

const DOW_MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

/** Round to the nearest 5 minutes, clamp to 0–180 (the slider's range). */
function snap(minutes: number): number {
  return Math.max(0, Math.min(180, Math.round(minutes / 5) * 5));
}

/**
 * Seven Monday-first day budgets. Prefers, in order: explicit `dayBudgets`,
 * the profile's weekly hours + distribution, then the timePreference table.
 */
export function deriveDayBudgets(
  input: Pick<PlannerInput, 'timePreference' | 'dayBudgets' | 'profile'>,
): number[] {
  if (input.dayBudgets && input.dayBudgets.length === 7) {
    return input.dayBudgets.map((m) => Math.max(0, Math.round(m)));
  }
  const p = input.profile;
  if (p?.weeklyHours !== undefined && p.weeklyHours > 0) {
    const weights = DISTRIBUTION_WEIGHTS[p.distribution ?? 'spread'];
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const totalMinutes = p.weeklyHours * 60;
    return weights.map((w) => snap((totalMinutes * w) / totalWeight));
  }
  return DOW_MONDAY_FIRST.map((dow) => getDayBudget(dow, input.timePreference));
}
