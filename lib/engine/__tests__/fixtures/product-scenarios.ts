import type { PlannerInput, Task } from '../../types.js';

const custom = (id: string, title: string, minutes: number): Task => ({
  id, title, zone: 'general', frequency: 'weekly',
  typicalMinutes: { S: minutes, M: minutes, L: minutes, XL: minutes },
  chaosImpact: 0.8, fatigueCost: 0.5, tags: ['custom'],
  flooringTypes: null, petTypes: null, seasonalMonths: null, homeTypes: null,
});
const base: PlannerInput = {
  homeSize: 'M', homeType: 'single-family', householdCount: 2, petTypes: [],
  kids: false, flooringTypes: ['hardwood'], timePreference: 'steady',
  weekOf: new Date('2026-11-02T00:00:00.000Z'), priorities: [],
  profile: { adults: 2, kidAges: { under5: 0, age5to12: 0, teen: 0 }, bathrooms: 2, floors: 1, weeklyHours: 3.5, distribution: 'spread' },
};
function input(changes: Partial<PlannerInput>, profile: NonNullable<PlannerInput['profile']>): PlannerInput {
  return { ...base, ...changes, profile: { ...base.profile, ...profile } };
}
export const scenarios = [
  { id: 'A', description: 'Single adult, studio/1-bedroom apartment, 1 bath, no pets, 2 hours',
    input: input({ homeSize: 'S', homeType: 'apartment', householdCount: 1, timePreference: 'quick' }, { adults: 1, bathrooms: 1, weeklyHours: 2 }) },
  { id: 'B', description: 'Two adults, 3-bedroom home, 2 baths, no pets, 3.5 hours', input: input({}, {}) },
  { id: 'C', description: 'Two adults, two young children, 3 bedrooms, 2 baths, one large dog, 3.5 hours',
    input: input({ householdCount: 4, kids: true, petTypes: ['large-dog-1-2'] }, { kidAges: { under5: 2, age5to12: 0, teen: 0 } }) },
  { id: 'D', description: 'Single parent, three children, 3 bedrooms, two pets, 2 hours',
    input: input({ householdCount: 4, kids: true, petTypes: ['cat-1-2', 'small-dog-1-2'], timePreference: 'quick' }, { adults: 1, kidAges: { under5: 1, age5to12: 2, teen: 0 }, weeklyHours: 2 }) },
  { id: 'E', description: 'Two adults, 5-bedroom house, 3 baths, mixed floors, 6 hours',
    input: input({ homeSize: 'L', homeType: 'large-home', flooringTypes: ['mixed'], timePreference: 'thorough' }, { bathrooms: 3, floors: 2, weeklyHours: 6 }) },
  { id: 'F', description: 'Two adults, 4-bedroom home, 2 baths, mostly weekends, 3.5 hours',
    input: input({ homeSize: 'L' }, { floors: 2, distribution: 'weekends' }) },
  { id: 'G', description: 'Single adult, 2-bedroom apartment, cats, limited weekdays, 2 hours',
    input: input({ homeType: 'apartment', householdCount: 1, petTypes: ['cat-1-2'], timePreference: 'quick' }, { adults: 1, bathrooms: 1, weeklyHours: 2, distribution: 'weekends' }) },
  { id: 'H', description: 'Six-person household, multiple pets, custom tasks, 3.5 hours',
    input: input({ homeSize: 'L', householdCount: 6, kids: true, petTypes: ['cat-3-plus', 'large-dog-1-2'], flooringTypes: ['mixed'], customTasks: [custom('custom-p1-pet-bedding', 'Wash pet bedding', 25), custom('custom-p1-playroom', 'Reset playroom storage', 15)] }, { adults: 3, kidAges: { under5: 1, age5to12: 1, teen: 1 }, bathrooms: 3, floors: 2 }) },
];
