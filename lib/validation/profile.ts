import { z } from 'zod';

/** Zod mirror of lib/engine/types.ts HouseholdProfile. Every field optional. */
export const kidAgesSchema = z.object({
  under5:   z.number().int().min(0).max(8),
  age5to12: z.number().int().min(0).max(8),
  teen:     z.number().int().min(0).max(8),
});

export const setupSchema = z.object({
  dishes:      z.enum(['dishwasher', 'hand']).optional(),
  robotVacuum: z.boolean().optional(),
  laundry:     z.enum(['in-home', 'shared']).optional(),
  lawn:        z.boolean().optional(),
}).strict();

export const profileSchema = z.object({
  setup:        setupSchema.optional(),
  adults:       z.number().int().min(1).max(8).optional(),
  kidAges:      kidAgesSchema.optional(),
  bathrooms:    z.number().int().min(1).max(4).optional(),
  floors:       z.union([z.literal(1), z.literal(2)]).optional(),
  weeklyHours:  z.number().min(0.5).max(30).optional(),
  distribution: z.enum(['spread', 'weekends', 'weekdays']).optional(),
}).strict();

export const prioritySchema = z.enum(['kitchen-reset', 'bathrooms', 'floors', 'clutter', 'pet-mess']);
export const prioritiesSchema = z.array(prioritySchema).max(3);

import type { HouseholdProfile, HouseholdSetup } from '@/lib/engine/types.js';

/**
 * Zod's `.optional()` output permits explicit `undefined` values, which the
 * engine's HouseholdProfile (compiled with exactOptionalPropertyTypes) does
 * not. Strip them so the object is assignable.
 */
export function toHouseholdProfile(p: z.infer<typeof profileSchema>): HouseholdProfile {
  const out: HouseholdProfile = {};
  if (p.adults !== undefined) out.adults = p.adults;
  if (p.kidAges !== undefined) out.kidAges = p.kidAges;
  if (p.bathrooms !== undefined) out.bathrooms = p.bathrooms;
  if (p.floors !== undefined) out.floors = p.floors;
  if (p.weeklyHours !== undefined) out.weeklyHours = p.weeklyHours;
  if (p.distribution !== undefined) out.distribution = p.distribution;
  if (p.setup !== undefined) {
    const setup: HouseholdSetup = {};
    if (p.setup.dishes !== undefined) setup.dishes = p.setup.dishes;
    if (p.setup.robotVacuum !== undefined) setup.robotVacuum = p.setup.robotVacuum;
    if (p.setup.laundry !== undefined) setup.laundry = p.setup.laundry;
    if (p.setup.lawn !== undefined) setup.lawn = p.setup.lawn;
    if (Object.keys(setup).length > 0) out.setup = setup;
  }
  return out;
}
