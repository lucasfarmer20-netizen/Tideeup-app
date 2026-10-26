import type {
  FlooringType,
  HomeSize,
  HomeType,
  PetType,
  PlannerInput,
  ScoredTask,
  Season,
  Task,
  Zone,
} from './types.js';
import { getSeasonWeight } from './seasons.js';
import { effectiveHouseholdCount, kidChaosLevel, zoneMinuteMultiplier } from './profile.js';

// ─── Frequency base weights ───────────────────────────────────────────────────
// Daily tasks must always win allocation; monthly tasks compete at the bottom.
export const FREQUENCY_WEIGHT: Record<Task['frequency'], number> = {
  daily:   100,
  weekly:   10,
  monthly:   1,
};

// ─── Home size score multipliers ─────────────────────────────────────────────
// Larger homes have more to clean → higher priority scores.
const HOME_SIZE_SCORE_MULTIPLIER: Record<HomeSize, number> = {
  S:  0.80,
  M:  1.00,
  L:  1.25,
  XL: 1.55,
};

// ─── Household count score scaling ───────────────────────────────────────────
// Normalised to a 3-person baseline. Clamped to [1, 6].
function householdScoreMultiplier(count: number): number {
  const clamped = Math.max(1, Math.min(6, count));
  return clamped / 3;
}

// ─── Pet chaos ────────────────────────────────────────────────────────────────
// How much each pet type contributes to household chaos (0–1 scale per type).
// Multiple types sum together, capped at 1.
const PET_CHAOS_LEVEL: Record<PetType, number> = {
  'cat-1-2':          0.30,
  'cat-3-plus':       0.55,
  'small-dog-1-2':    0.45,
  'large-dog-1-2':    0.75,
  'large-dog-3-plus': 1.00,
  'small-animals':    0.15,
  'other':            0.25,
};

function petChaosLevel(petTypes: PetType[]): number {
  if (petTypes.length === 0) return 0;
  const total = petTypes.reduce((sum, p) => sum + (PET_CHAOS_LEVEL[p] ?? 0), 0);
  return Math.min(1, total);
}

// ─── Chaos score multiplier ───────────────────────────────────────────────────
function chaosMultiplier(task: Task, petTypes: PetType[], kidLevel: number): number {
  const baseMin = task.typicalMinutes['M'];
  let bonus = 0;
  const petLevel = petChaosLevel(petTypes);
  if (petLevel > 0 && task.petBoost !== undefined && baseMin > 0) {
    bonus += (task.petBoost / baseMin) * task.chaosImpact * petLevel;
  }
  // kidLevel: 0 = none, 0.6 = legacy `kids: true` (one 5–12), up to 1.5.
  if (kidLevel > 0 && task.kidsBoost !== undefined && baseMin > 0) {
    bonus += (task.kidsBoost / baseMin) * task.chaosImpact * (kidLevel / 0.6);
  }
  return 1 + bonus;
}

// ─── Time estimation ──────────────────────────────────────────────────────────
// Zones that count as "shared space" for the 6+ household multiplier.
const SHARED_ZONES: ReadonlySet<Zone> = new Set([
  'kitchen', 'bathroom', 'living', 'laundry', 'general',
]);

type ScoreInput = Pick<PlannerInput, 'homeSize' | 'householdCount' | 'petTypes' | 'kids' | 'profile'>;

function estimateMinutes(task: Task, input: ScoreInput): number {
  let minutes = task.typicalMinutes[input.homeSize];
  const hasPets = input.petTypes.length > 0;
  if (hasPets && task.petBoost) minutes += task.petBoost;
  const kidLevel = kidChaosLevel(input);
  if (kidLevel > 0 && task.kidsBoost) minutes += task.kidsBoost * (kidLevel / 0.6);
  // Bathrooms and floors (quiz v2) scale the zone's minutes.
  minutes *= zoneMinuteMultiplier(task.zone, task, input.profile);
  // 6+ household members: shared-space tasks take 40% longer
  if (effectiveHouseholdCount(input) >= 6 && SHARED_ZONES.has(task.zone)) {
    minutes = Math.round(minutes * 1.4);
  }
  return Math.max(1, Math.round(minutes));
}

// ─── Household eligibility filter ────────────────────────────────────────────

export function isEligibleForHousehold(
  task: Task,
  petTypes: PetType[],
  flooringTypes: FlooringType[],
  homeType: HomeType,
  currentMonth: number,
): boolean {
  // Pet filter: task requires specific pet type(s)
  if (task.petTypes !== null) {
    const match = task.petTypes.some((p) => petTypes.includes(p));
    if (!match) return false;
  }
  // Flooring filter: task requires specific flooring type(s)
  if (task.flooringTypes !== null) {
    const match = task.flooringTypes.some((f) => flooringTypes.includes(f));
    if (!match) return false;
  }
  // Home type filter
  if (task.homeTypes !== null && !task.homeTypes.includes(homeType)) {
    return false;
  }
  // Seasonal months filter
  if (task.seasonalMonths !== null && !task.seasonalMonths.includes(currentMonth)) {
    return false;
  }
  return true;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Score and time-estimate a single task for this household.
 */
export function scoreTask(
  task: Task,
  input: ScoreInput,
  season: Season,
): ScoredTask {
  const score =
    FREQUENCY_WEIGHT[task.frequency] *
    HOME_SIZE_SCORE_MULTIPLIER[input.homeSize] *
    householdScoreMultiplier(effectiveHouseholdCount(input)) *
    getSeasonWeight(task.zone, season) *
    chaosMultiplier(task, input.petTypes, kidChaosLevel(input));

  return {
    task,
    score: Math.round(score * 100) / 100,
    estimatedMinutes: estimateMinutes(task, input),
  };
}

/**
 * Filter tasks by household eligibility, score them, and return sorted
 * highest-score-first. Pass currentMonth (1–12) for seasonal filtering.
 */
export function scoreAndSort(
  tasks: Task[],
  input: Pick<
    PlannerInput,
    'homeSize' | 'householdCount' | 'petTypes' | 'kids' | 'flooringTypes' | 'homeType' | 'profile'
  >,
  season: Season,
  currentMonth: number,
): ScoredTask[] {
  return tasks
    .filter((t) =>
      isEligibleForHousehold(t, input.petTypes, input.flooringTypes, input.homeType, currentMonth),
    )
    .map((t) => scoreTask(t, input, season))
    .sort((a, b) => b.score - a.score);
}
