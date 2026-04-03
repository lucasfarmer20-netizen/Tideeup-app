import type { Season, Zone } from './types.js';

/**
 * Per-zone score multipliers for each season.
 * Values > 1 boost a zone's tasks; values < 1 suppress them.
 */
const SEASON_WEIGHTS: Record<Season, Record<Zone, number>> = {
  spring: {
    kitchen:  1.15, // spring cleaning — fridge, oven, pantry
    bathroom: 1.10, // grout, deep scrubs
    bedroom:  1.05, // declutter, change bedding weights
    living:   1.10, // windows, baseboards
    outdoor:  1.35, // garden prep, outdoor sweep
    laundry:  1.10, // curtains, seasonal fabrics
    general:  1.20, // window washing, baseboards
  },
  summer: {
    kitchen:  1.00,
    bathroom: 1.00,
    bedroom:  1.00,
    living:   0.95,
    outdoor:  1.25, // mowing, gardening
    laundry:  1.20, // more clothing changes, swimwear
    general:  1.00,
  },
  fall: {
    kitchen:  1.05, // bulk cooking season starts
    bathroom: 1.00,
    bedroom:  1.10, // swap seasonal bedding
    living:   1.05,
    outdoor:  1.30, // leaf cleanup, gutter prep
    laundry:  1.10, // seasonal swap
    general:  1.05,
  },
  winter: {
    kitchen:  1.10, // holiday cooking, oven use
    bathroom: 1.05,
    bedroom:  1.05, // extra warmth, heavier linens
    living:   1.15, // spend more time indoors
    outdoor:  0.50, // suppress most outdoor tasks
    laundry:  1.00,
    general:  1.05,
  },
};

/**
 * Derive the current season from a date.
 * Uses meteorological seasons (month-based, Northern Hemisphere).
 * Pass seasonOverride in PlannerInput to bypass this.
 */
export function detectSeason(date: Date): Season {
  const month = date.getUTCMonth() + 1; // 1–12
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

/**
 * Returns the weight multiplier for a task zone in the given season.
 */
export function getSeasonWeight(zone: Zone, season: Season): number {
  return SEASON_WEIGHTS[season][zone];
}
