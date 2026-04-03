import type { Zone } from '../engine/types.js';

/**
 * Zone anchor configuration.
 *
 * Each weekday is anchored to a primary and secondary zone.
 * The planner boosts scores for tasks matching the primary zone
 * and slightly boosts the secondary zone, reducing unnecessary
 * context-switching across the week.
 *
 * dayOfWeek: 0 = Sunday, 1 = Monday … 6 = Saturday
 */
export interface ZoneAnchor {
  dayOfWeek: number;
  primary: Zone;
  secondary: Zone;
}

export const ZONE_ANCHORS: ZoneAnchor[] = [
  { dayOfWeek: 0, primary: 'general',  secondary: 'laundry'   }, // Sunday   — wrap-up / overflow
  { dayOfWeek: 1, primary: 'kitchen',  secondary: 'general'   }, // Monday   — kitchen reset
  { dayOfWeek: 2, primary: 'bathroom', secondary: 'laundry'   }, // Tuesday  — bathrooms + laundry
  { dayOfWeek: 3, primary: 'bedroom',  secondary: 'general'   }, // Wednesday — bedrooms
  { dayOfWeek: 4, primary: 'living',   secondary: 'kitchen'   }, // Thursday — living spaces
  { dayOfWeek: 5, primary: 'laundry',  secondary: 'general'   }, // Friday   — laundry clear-out
  { dayOfWeek: 6, primary: 'outdoor',  secondary: 'general'   }, // Saturday — outdoor + deep tasks
];

/** Score multipliers applied when a task's zone matches the day anchor */
export const ZONE_ANCHOR_BONUS = {
  primary: 1.4,
  secondary: 1.15,
  none: 1.0,
} as const;

/**
 * Returns the anchor for a given day of week.
 * Guaranteed to return a value because ZONE_ANCHORS covers 0–6.
 */
export function getZoneAnchor(dayOfWeek: number): ZoneAnchor {
  const anchor = ZONE_ANCHORS.find((a) => a.dayOfWeek === dayOfWeek);
  if (!anchor) throw new Error(`No zone anchor for dayOfWeek ${dayOfWeek}`);
  return anchor;
}

/**
 * Returns the zone anchor bonus multiplier for a task zone on a given day.
 */
export function zoneAnchorMultiplier(taskZone: Zone, dayOfWeek: number): number {
  const anchor = getZoneAnchor(dayOfWeek);
  if (taskZone === anchor.primary) return ZONE_ANCHOR_BONUS.primary;
  if (taskZone === anchor.secondary) return ZONE_ANCHOR_BONUS.secondary;
  return ZONE_ANCHOR_BONUS.none;
}
