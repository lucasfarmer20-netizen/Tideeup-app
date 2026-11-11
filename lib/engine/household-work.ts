import { TASK_LIBRARY } from '../tasks/library.js';
import { effectiveHouseholdCount, kidChaosLevel } from './profile.js';
import type { CleaningCategory, PlannerInput, Task } from './types.js';

const bounded = (n: number | undefined, fallback: number, min: number, max: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
const ROBOT_FLOORS = new Set(['sweep-high-traffic', 'vacuum-carpet-living', 'vacuum-carpet-bedroom',
  'sweep-hardwood-living', 'sweep-hardwood-bedroom', 'vacuum-kitchen-rug']);
const LAUNDRY = new Set(['laundry-wash-dry', 'laundry-fold-put-away']);
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
  // Tidying is the one task where kids dominate, so its cap is the full base.
  const extraCap = task.id === 'tidy-common-areas' ? 1 : 0.35;
  const extra = Math.min(base * extraCap, (input.petTypes.length ? task.petBoost ?? 0 : 0) + (task.kidsBoost ?? 0) * kids);
  let minutes = Math.round((base + extra) * (task.tags.includes('floors') && input.profile?.floors === 2 ? 1.2 : 1));
  let scope = 'Full task for this home';
  if (task.tags.includes('floors')) scope = 'Full named floor area; home size estimates area';
  if (task.id === 'laundry-wash-dry') scope = 'Household laundry batch — active handling; load count unconfirmed, excludes machine time and folding';
  if (task.id === 'laundry-fold-put-away') scope = 'Fold and put away the household laundry batch; load count unconfirmed';
  if (task.id === 'change-bed-sheets') scope = 'Change household bed sheets; bed count estimated from home size, excludes washing';
  let essentialOccurrences = 0;
  let cadence = task.cadence;
  let title = task.title;
  const setup = input.profile?.setup;
  if (task.zone === 'bathroom' && !task.tags.includes('pet')) {
    minutes = task.typicalMinutes.S * bathrooms;
    scope = `All ${bathrooms} bathroom${bathrooms === 1 ? '' : 's'}`;
  }
  if (task.id === 'dishes') {
    // Hand washing roughly doubles the active time of loading a dishwasher.
    if (setup?.dishes === 'hand') { minutes = 8 + 2 * people; title = 'Wash dishes by hand'; scope = 'Daily hand washing, drying and putting away'; }
    else { minutes = 4 + people; scope = 'Daily dishes / dishwasher handling (active time)'; if (setup?.dishes === 'dishwasher') title = 'Unload and load the dishwasher'; }
    essentialOccurrences = 7;
  } else if (task.id === 'litter-box-scoop') {
    minutes = input.petTypes.includes('cat-3-plus') ? 7 : 4;
    // The one-minute bowl wipe rides along instead of being its own line.
    minutes += input.petTypes.includes('cat-3-plus') ? 2 : 1; title = 'Scoop litter box and refresh cat bowls';
    scope = 'Household litter scooping and cat bowls; box count needs confirmation'; essentialOccurrences = 7;
  } else if (task.id === 'cat-food-water-bowls') {
    minutes = input.petTypes.includes('cat-3-plus') ? 2 : 1;
    scope = 'Wipe household cat bowls'; essentialOccurrences = 7;
  } else if (task.id === 'dog-water-bowl-refresh') {
    minutes = input.petTypes.includes('large-dog-3-plus') ? 2 : 1;
    scope = 'Refresh household dog water'; essentialOccurrences = 7;
  } else if (task.id === 'quick-bathroom-wipe') {
    cadence = { target: 2, min: 1 }; essentialOccurrences = 1;
  } else if (task.id === 'tidy-common-areas') {
    cadence = { target: 3, min: 1 }; essentialOccurrences = 1;
  } else if (task.id === 'wipe-kitchen-counters') {
    cadence = { target: 4, min: 1 };
  } else if (['sweep-high-traffic', 'mop-entry-after-walks', 'take-out-kitchen-trash'].includes(task.id)) {
    cadence = { target: 3, min: 1 };
  } else if (task.id === 'make-beds') {
    cadence = { target: 3, min: 0 };
  }
  // Laundry is per load, start to put-away, not one weekly batch: about one
  // and a quarter loads per person. A load is not done until it is put away,
  // so washing and folding are one task. Shared or laundromat machines add
  // carrying and waiting-around time.
  if (task.id === 'laundry-wash-dry') {
    const loads = Math.max(1, Math.min(7, Math.round(people * 1.25)));
    minutes = setup?.laundry === 'shared' ? 20 : 15;
    title = 'Laundry load: wash, dry, fold, put away';
    scope = `One of about ${loads} household load${loads === 1 ? '' : 's'} this week; active handling only, excludes machine time`;
    cadence = { target: loads, min: 1 };
    essentialOccurrences = 1; // a week with no laundry at all is not a usable plan
  }
  // A robot vacuum does the run; what is left is clearing the floor, emptying
  // the bin and catching edges.
  if (setup?.robotVacuum && ROBOT_FLOORS.has(task.id)) {
    minutes = Math.max(3, Math.round(minutes * 0.25));
    scope = 'Robot vacuum does the run: clear the floor, empty the bin, catch edges';
  }
  return { ...task, title, ...(cadence ? { cadence } : {}),
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
  // Folded into a neighbouring task (lint trap into laundry, cat bowls into
  // litter) or switched off by a setup answer.
  const hasCats = input.petTypes.some(p => p.startsWith('cat'));
  const skip = (id: string) => id === 'dryer-lint-trap' || (id === 'cat-food-water-bowls' && hasCats)
    || (id === 'mow-lawn' && input.profile?.setup?.lawn === false);
  const full = TASK_LIBRARY.filter(task => !skip(task.id)).map(task => calibrate(task, input));
  const byId = new Map(full.map(t => [t.id, t]));
  const shorter = [
    alternative(byId.get('quick-bathroom-wipe')!, 'p2-bathroom-wipe-one', 'Quick sink and toilet wipe — one bathroom', 'One bathroom only; not all household bathrooms', 4),
    alternative(byId.get('clean-shower-tub')!, 'p2-shower-one', 'Scrub one shower or tub', 'One shower or tub only', 12),
    alternative(byId.get('sweep-high-traffic')!, 'p2-floor-one-area', 'Sweep one busy floor area', 'One floor area only; not the full traffic route', 5),
    alternative(byId.get('laundry-wash-dry')!, 'p2-laundry-one-load', 'Run one laundry load — active handling', 'One load only; excludes folding and machine running time', 10),
    alternative(byId.get('laundry-fold-put-away')!, 'p2-fold-one-load', 'Fold and put away one laundry load', 'One load only; not all household laundry', 10),
    alternative(byId.get('change-bed-sheets')!, 'p2-sheets-one-bed', 'Change sheets on one bed', 'One bed only; excludes washing the sheets', 8),
  ].filter(t => t.work!.minutes < byId.get(t.work!.alternativeFor!)!.work!.minutes && !LAUNDRY.has(t.work!.alternativeFor!));
  // Never transform or shorten caller-defined tasks, including a custom title
  // that resembles a built-in task. Duplicate IDs are rejected at generation.
  // Folding now lives inside the per-load laundry task.
  return [...full.filter(t => t.id !== 'laundry-fold-put-away'), ...shorter, ...(input.customTasks ?? [])];
}
