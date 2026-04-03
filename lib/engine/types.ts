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
  frequency: Frequency;
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

export interface WeekPlan {
  weekOf: Date;
  days: DayPlan[];
  /** Tasks that scored but couldn't fit within any day's budget */
  spillover: Task[];
  metadata: {
    totalTasksScheduled: number;
    totalMinutesPlanned: number;
    season: Season;
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
}
