import { TASK_LIBRARY } from '../tasks/library.js';
import { effectiveHouseholdCount, kidChaosLevel } from './profile.js';
import type { CleaningCategory, PlannerInput, Task } from './types.js';

const bounded = (n: number | undefined, fallback: number, min: number, max: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
const UPKEEP = new Set(['dishes', 'litter-box-scoop', 'cat-food-water-bowls', 'dog-water-bowl-refresh']);

export function workCategory(task: Task): CleaningCategory {
  if (task.tags.includes('custom')) return 'custom';
  if (task.work) return task.work.category;
  if (UPKEEP.has(task.id) && task.tags.includes('pet')) return 'pet-care';
  if (task.frequency === 'monthly') return 'rotating';
  if (task.tags.includes('floors')) return 'floors';
  if (task.zone === 'general' || task.zone === 'living') return 'clutter';
  return task.zone;
}

/** Active-time hypotheses, not time measurements. Scope, not a chain of
 * unrelated multipliers, determines an estimate. Historical serialized tasks
 * and the original library remain untouched; only newly generated plans use P2. */
function calibrate(task: Task, input: PlannerInput): Task {
  const people = bounded(effectiveHouseholdCount(input), 2, 1, 6);
  const bathrooms = bounded(input.profile?.bathrooms, 1, 1, 4);
  const kids = bounded(kidChaosLevel(input), 0, 0, 1.5);
  const base = task.typicalMinutes[input.homeSize];
  // Home size already represents area. Bound extra mess to 35% of that base;
  // do not multiply it again by people, bathrooms and floors simultaneously.
  const extra = Math.min(base * 0.35, (input.petTypes.length ? task.petBoost ?? 0 : 0) + (task.kidsBoost ?? 0) * kids);
  let minutes = Math.round((base + extra) * (task.tags.includes('floors') && input.profile?.floors === 2 ? 1.2 : 1));
  let scope = 'Full task for this home';
  if (task.tags.includes('floors')) scope = 'Full named floor area; home size estimates area';
  if (task.id === 'laundry-wash-dry') scope = 'Household laundry batch — active handling; load count unconfirmed, excludes machine time and folding';
  if (task.id === 'laundry-fold-put-away') scope = 'Fold and put away the household laundry batch; load count unconfirmed';
  if (task.id === 'change-bed-sheets') scope = 'Change household bed sheets; bed count estimated from home size, excludes washing';
  let essentialOccurrences = 0;
  let cadence = task.cadence;
  if (task.zone === 'bathroom' && !task.tags.includes('pet')) {
    minutes = task.typicalMinutes.S * bathrooms;
    scope = `All ${bathrooms} bathroom${bathrooms === 1 ? '' : 's'}`;
  }
  if (task.id === 'dishes') {
    minutes = 4 + people; scope = 'Daily dishes / dishwasher handling (active time)'; essentialOccurrences = 7;
  } else if (task.id === 'litter-box-scoop') {
    minutes = input.petTypes.includes('cat-3-plus') ? 7 : 4;
    scope = 'Household litter scooping; box count needs confirmation'; essentialOccurrences = 7;
  } else if (task.id === 'cat-food-water-bowls') {
    minutes = input.petTypes.includes('cat-3-plus') ? 2 : 1;
    scope = 'Wipe household cat bowls'; essentialOccurrences = 7;
  } else if (task.id === 'dog-water-bowl-refresh') {
    minutes = input.petTypes.includes('large-dog-3-plus') ? 2 : 1;
    scope = 'Refresh household dog water'; essentialOccurrences = 7;
  } else if (task.id === 'quick-bathroom-wipe') {
    cadence = { target: 2, min: 1 }; essentialOccurrences = 1;
  } else if (task.id === 'tidy-common-areas') {
    cadence = { target: 3, min: 1 };
  } else if (task.id === 'wipe-kitchen-counters') {
    cadence = { target: 4, min: 1 };
  } else if (['sweep-high-traffic', 'mop-entry-after-walks', 'take-out-kitchen-trash'].includes(task.id)) {
    cadence = { target: 3, min: 1 };
  } else if (task.id === 'make-beds') {
    cadence = { target: 3, min: 0 };
  }
  return { ...task, ...(cadence ? { cadence } : {}),
    tags: task.id === 'tidy-common-areas' ? task.tags.filter(t => t !== 'protected') : task.tags,
    work: { kind: UPKEEP.has(task.id) ? 'upkeep' : 'cleaning', category: workCategory(task), scope,
      minutes: Math.max(1, Math.round(minutes)), essentialOccurrences } };
}

/** A smaller task is never another completion identity for the full task. These
 * IDs retain their scope through progress and rotation. No parent credit, room
 * assignment, splitting or "all rooms done" inference is performed. */
function alternative(parent: Task, id: string, title: string, scope: string, minutes: number): Task {
  return { ...parent, id, title, frequency: 'weekly', cadence: { target: 1, min: 0 },
    typicalMinutes: { S: minutes, M: minutes, L: minutes, XL: minutes },
    fatigueCost: Math.min(parent.fatigueCost, 0.25), tags: parent.tags.filter(t => t !== 'protected'),
    work: { kind: 'cleaning', category: parent.work!.category, scope, minutes, essentialOccurrences: 0, alternativeFor: parent.id } };
}

export function householdTasks(input: PlannerInput): Task[] {
  const full = TASK_LIBRARY.map(task => calibrate(task, input));
  const byId = new Map(full.map(t => [t.id, t]));
  const shorter = [
    alternative(byId.get('quick-bathroom-wipe')!, 'p2-bathroom-wipe-one', 'Quick sink and toilet wipe — one bathroom', 'One bathroom only; not all household bathrooms', 4),
    alternative(byId.get('clean-shower-tub')!, 'p2-shower-one', 'Scrub one shower or tub', 'One shower or tub only', 12),
    alternative(byId.get('sweep-high-traffic')!, 'p2-floor-one-area', 'Sweep one busy floor area', 'One floor area only; not the full traffic route', 5),
    alternative(byId.get('laundry-wash-dry')!, 'p2-laundry-one-load', 'Run one laundry load — active handling', 'One load only; excludes folding and machine running time', 10),
    alternative(byId.get('laundry-fold-put-away')!, 'p2-fold-one-load', 'Fold and put away one laundry load', 'One load only; not all household laundry', 10),
    alternative(byId.get('change-bed-sheets')!, 'p2-sheets-one-bed', 'Change sheets on one bed', 'One bed only; excludes washing the sheets', 8),
  ].filter(t => t.work!.minutes < byId.get(t.work!.alternativeFor!)!.work!.minutes);
  // Never transform or shorten caller-defined tasks, including a custom title
  // that resembles a built-in task. Duplicate IDs are rejected at generation.
  return [...full, ...shorter, ...(input.customTasks ?? [])];
}
