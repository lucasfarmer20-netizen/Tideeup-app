// ─── Domain primitives ────────────────────────────────────────────────────────

export type Zone =
  | 'kitchen'
  | 'bathroom'
  | 'bedroom'
  | 'living'
  | 'outdoor'
  | 'laundry'
  | 'general';

export type Frequency = 'daily' | 'weekly' | 'monthly';

/**
 * How often a task should happen, expressed per week.
 *
 * `target` is the ideal number of occurrences in a week; `min` is the floor the
 * engine may degrade to when the household's time supply can't cover demand.
 * Daily tasks are typically 7/7 (never trimmed) or 7/3 (fine at three days a
 * week when pressed). Weekly tasks are 1/0: ideally this week, but allowed to
 * slip a week. Monthly tasks are 0.25/0: due roughly every fourth week.
 */
export interface Cadence {
  target: number;
  min: number;
}

/**
 * A free-tier household's priorities, picked on the quiz. Each one marks a set
 * of tasks as protected from degradation (see lib/engine/cadence.ts).
 */
export type Priority =
  | 'kitchen-reset'
  | 'bathrooms'
  | 'floors'
  | 'clutter'
  | 'pet-mess';

/** Kids by age band — each band is a count. */
export type KidAgeBand = 'under5' | 'age5to12' | 'teen';
export type KidAges = Record<KidAgeBand, number>;

/** How the household wants its weekly time spread across the week. */
export type TimeDistribution = 'spread' | 'weekends' | 'weekdays';

/**
 * Richer household profile from quiz v2. Every field is optional so older
 * callers (saved plans, the Sunday cron, tests) keep working; the engine
 * derives sensible values from the coarse fields when these are absent.
 */
export interface HouseholdProfile {
  /** Adults in the home (≥1). Replaces the adult share of `householdCount`. */
  adults?: number;
  /** Kids by age band. Replaces the `kids` boolean when present. */
  kidAges?: KidAges;
  /** Number of bathrooms (1–4+). Scales bathroom-zone minutes. */
  bathrooms?: number;
  /** 1 or 2+ floors. 2+ adds stair/multi-floor overhead to floor tasks. */
  floors?: 1 | 2;
  /** Hours per week the household can give (replaces timePreference). */
  weeklyHours?: number;
  /** How those hours fall across the week. */
  distribution?: TimeDistribution;
}

export type HomeSize = 'S' | 'M' | 'L' | 'XL';

/** User-facing time commitment per day */
export type TimePreference = 'quick' | 'steady' | 'thorough' | 'batch';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export type FlooringType = 'hardwood' | 'carpet' | 'tile' | 'mixed';

export type PetType =
  | 'cat-1-2'
  | 'cat-3-plus'
  | 'small-dog-1-2'
  | 'large-dog-1-2'
  | 'large-dog-3-plus'
  | 'small-animals'
  | 'other';

export type HomeType =
  | 'apartment'
  | 'townhouse'
  | 'single-family'
  | 'large-home';

// ─── Task definition (from library) ──────────────────────────────────────────

export interface Task {
  /** Stable kebab-case identifier */
  id: string;
  title: string;
  zone: Zone;
  /**
   * Coarse frequency class. Still used by the UI to split "stabilisers" from
   * featured tasks, and by rotation memory. The engine schedules on `cadence`.
   */
  frequency: Frequency;
  /**
   * Per-week cadence. Optional: when omitted it is derived from `frequency`
   * (daily → 7/7, weekly → 1/0, monthly → 0.25/0). Set it explicitly on daily
   * tasks that are fine at fewer than seven days a week.
   */
  cadence?: Cadence;
  /**
   * Active work time in minutes, explicitly specified per home size.
   * Replaces the old baseMinutes + home-size multiplier approach.
   */
  typicalMinutes: Record<HomeSize, number>;
  /**
   * 0–1: how much household chaos (pets/kids) inflates this task's priority.
   */
  chaosImpact: number;
  /**
   * 0–1: physical/mental cost of doing this task.
   * Used by the budgeter for fatigue smoothing across days.
   */
  fatigueCost: number;
  tags: string[];
  /** Extra flat minutes added when any qualifying pet is present */
  petBoost?: number;
  /** Extra flat minutes added when kids are present */
  kidsBoost?: number;
  /**
   * Task only surfaces for households with at least one matching flooring type.
   * null = applies to all households regardless of flooring.
   */
  flooringTypes: FlooringType[] | null;
  /**
   * Task only surfaces for households with at least one matching pet type.
   * null = applies to all households regardless of pets.
   */
  petTypes: PetType[] | null;
  /**
   * Task only surfaces in the listed calendar months (1–12).
   * null = year-round.
   */
  seasonalMonths: number[] | null;
  /**
   * Task only surfaces for matching home types.
   * null = applies to all home types.
   */
  homeTypes: HomeType[] | null;
}

// ─── Engine internal ──────────────────────────────────────────────────────────

export interface ScoredTask {
  task: Task;
  /** Computed priority score — higher wins */
  score: number;
  /** Adjusted time estimate for this household */
  estimatedMinutes: number;
}

export interface ScheduledTask {
  task: Task;
  estimatedMinutes: number;
  zone: Zone;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface DayPlan {
  /** Midnight UTC of this day */
  date: Date;
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: number;
  tasks: ScheduledTask[];
  totalMinutes: number;
  /** Maximum minutes budgeted for this day */
  budget: number;
  /** Cumulative fatigue (sum of fatigueCost for placed tasks) */
  fatigue: number;
}

/** One task whose cadence was reduced because demand exceeded supply. */
export interface TrimmedTask {
  taskId: string;
  title: string;
  /** Occurrences this week before and after trimming */
  from: number;
  to: number;
}

/**
 * How the household's weekly time supply compared with what the home needs.
 * `ratio` > 1 means the plan had to be trimmed; `coverage` is the share of
 * ideal demand that made it onto the plan (0–1).
 */
export interface PressureReport {
  supplyMinutes: number;
  /** Minutes the full-cadence plan would have needed */
  demandMinutes: number;
  /** demandMinutes / supplyMinutes (Infinity when supply is 0) */
  ratio: number;
  /** Minutes actually planned / demandMinutes */
  coverage: number;
  trimmed: TrimmedTask[];
}

export interface WeekPlan {
  weekOf: Date;
  days: DayPlan[];
  /** Tasks that scored but couldn't fit within any day's budget */
  spillover: Task[];
  metadata: {
    totalTasksScheduled: number;
    totalMinutesPlanned: number;
    season: Season;
    pressure: PressureReport;
  };
}

// ─── Rotation state (paid tier) ───────────────────────────────────────────────

export interface RotationState {
  /**
   * ISO date string of the last time each task was completed.
   * key: task.id, value: ISO 8601 date string
   */
  lastDone: Record<string, string>;
  /**
   * Which member is assigned to which tasks this cycle.
   * key: memberId, value: task ids assigned to them
   */
  memberAssignments: Record<string, string[]>;
}

// ─── Planner input ────────────────────────────────────────────────────────────

export interface PlannerInput {
  homeSize: HomeSize;
  homeType: HomeType;
  /**
   * 1–6. A value of 6 means "6 or more" and triggers a 1.4×
   * time multiplier on shared-space tasks (kitchen, bathroom, living,
   * laundry, general).
   */
  householdCount: number;
  /** Active pet types in the household — empty array means no pets */
  petTypes: PetType[];
  kids: boolean;
  /** Flooring types present in this home (multi-select) */
  flooringTypes: FlooringType[];
  timePreference: TimePreference;
  /** Any date within the target week — engine normalises to Monday midnight UTC */
  weekOf: Date;
  /** Paid tier: pass rotation state to enable smart task deduplication */
  rotationState?: RotationState;
  /** Override auto-detected season (useful for tests and edge cases) */
  seasonOverride?: Season;
  /**
   * Days of week (0=Sun … 6=Sat) to exclude from scheduling.
   * The engine sets these days' budget to 0.
   */
  noGoDays?: number[];
  /** Paid tier: custom tasks merged into the base library before scoring */
  customTasks?: Task[];
  /**
   * Per-day minute budgets, Monday first (index 0 = Mon … 6 = Sun).
   * When provided this overrides the `timePreference` budget table entirely —
   * it is how the Pro "Your week" sliders reach the engine. A 0 means no-go.
   */
  dayBudgets?: number[];
  /**
   * Household priorities from the quiz. Tasks matching a priority are protected
   * from degradation (kept at their target cadence) when time is short.
   */
  priorities?: Priority[];
  /** Quiz v2 profile. Optional; see HouseholdProfile. */
  profile?: HouseholdProfile;
}
