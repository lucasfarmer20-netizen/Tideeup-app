import type { RotationState, Task } from './types.js';

/**
 * Minimum days that must pass before a task is re-scheduled,
 * keyed by frequency. These are intentionally conservative —
 * the planner will naturally handle re-scheduling weekly tasks
 * ~7 days later, but the rotator guards against edge cases
 * (e.g. a user generating a new plan mid-week).
 */
const MIN_DAYS_SINCE_DONE: Record<Task['frequency'], number> = {
  daily:   0,   // always eligible
  weekly:  5,   // eligible after 5 days (gives ±2d flex)
  monthly: 21,  // eligible after 3 weeks
};

/**
 * Returns the number of calendar days between two dates (floor).
 */
function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / msPerDay);
}

/**
 * Returns true if a task is eligible for scheduling this week,
 * given the rotation state and the week's start date.
 *
 * When no rotation state is provided (free tier), every task is eligible.
 */
export function isEligible(
  task: Task,
  weekOf: Date,
  rotationState: RotationState | undefined,
): boolean {
  if (!rotationState) return true;

  const lastDoneStr = rotationState.lastDone[task.id];
  if (!lastDoneStr) return true; // never done → always eligible

  const lastDone = new Date(lastDoneStr);
  if (isNaN(lastDone.getTime())) return true; // malformed date → safe fallback

  const daysSince = daysBetween(lastDone, weekOf);
  return daysSince >= MIN_DAYS_SINCE_DONE[task.frequency];
}

/**
 * Filters a task list to only those eligible this week.
 */
export function filterByRotation(
  tasks: Task[],
  weekOf: Date,
  rotationState: RotationState | undefined,
): Task[] {
  return tasks.filter((t) => isEligible(t, weekOf, rotationState));
}

/**
 * Produces an updated RotationState after a week plan is confirmed.
 * Call this when the user marks a plan as "done" to persist the cycle.
 *
 * @param existing  Previous rotation state (or empty initial state)
 * @param doneIds   Task ids completed this week
 * @param weekOf    The week's start date (used as the "last done" timestamp)
 */
export function advanceRotation(
  existing: RotationState,
  doneIds: string[],
  weekOf: Date,
): RotationState {
  const isoDate = weekOf.toISOString().slice(0, 10);
  const lastDone: Record<string, string> = { ...existing.lastDone };
  for (const id of doneIds) {
    lastDone[id] = isoDate;
  }
  return { lastDone, memberAssignments: existing.memberAssignments };
}

/**
 * Distributes tasks evenly across household members.
 * Returns an updated RotationState with the new assignments.
 *
 * Simple round-robin — future versions can weight by fatigue or preference.
 */
export function assignToMembers(
  existing: RotationState,
  taskIds: string[],
  memberIds: string[],
): RotationState {
  if (memberIds.length === 0) return existing;

  const assignments: Record<string, string[]> = {};
  for (const m of memberIds) assignments[m] = [];

  taskIds.forEach((id, i) => {
    const member = memberIds[i % memberIds.length];
    if (member !== undefined) {
      assignments[member]!.push(id);
    }
  });

  return { lastDone: existing.lastDone, memberAssignments: assignments };
}
