import { describe, expect, it } from 'vitest';
import { generateWeekPlan } from '../planner.js';
import { householdTasks } from '../household-work.js';
import { getFatigueThreshold } from '../budgeter.js';
import { scenarios } from './fixtures/product-scenarios.js';
import { serializeWeekPlan, deserializeWeekPlan } from '../../../utils/serialize';
import { advanceRotation } from '../rotator.js';
import type { PlannerInput, Task } from '../types.js';

const base = scenarios[1]!.input;
const custom: Task = { ...scenarios[7]!.input.customTasks![0]!, id: 'custom-exact', typicalMinutes: { S: 17, M: 17, L: 17, XL: 17 } };

describe('explicit upkeep budgets and capacity', () => {
  it('defaults every existing profile to included without mutation or extra time', () => {
    for (const {input} of scenarios) {
      const saved = structuredClone(input);
      const a = generateWeekPlan(input), b = generateWeekPlan({...input, upkeepTime: {mode:'included'}});
      expect(a).toEqual(b); expect(input).toEqual(saved);
      expect(a.metadata.workload!.additionalUpkeepBudgetMinutes).toBe(0);
      expect(a.metadata.workload!.sessionBudgetMinutes).toBe(input.profile!.weeklyHours! * 60);
    }
  });
  it.each(scenarios)('$id separately budgets both kinds, conserving sessions and obeying combined time/fatigue', ({input}) => {
    const explicit: PlannerInput = {...input, upkeepTime: {mode:'separate', additionalDayBudgets: [20,20,20,20,20,20,20]}};
    const plan = generateWeekPlan(explicit);
    expect(plan).toEqual(generateWeekPlan(structuredClone(explicit)));
    const w = plan.metadata.workload!;
    expect(w.sessionBudgetMinutes).toBe(input.profile!.weeklyHours! * 60);
    expect(w.additionalUpkeepBudgetMinutes).toBe(140);
    expect(w.totalMinutes).toBe(w.upkeepMinutes + w.cleaningMinutes);
    expect(w.totalMinutes).toBe(plan.days.reduce((n,d)=>n+d.totalMinutes,0));
    for (const d of plan.days) {
      expect(d.budget).toBe(d.workload!.sessionBudget + d.workload!.additionalUpkeepBudget);
      expect(d.totalMinutes).toBeLessThanOrEqual(d.budget);
      expect(d.budget).toBeLessThanOrEqual(180);
      expect(d.workload!.cleaningMinutes).toBeLessThanOrEqual(d.workload!.sessionBudget);
      expect(d.workload!.upkeepMinutes).toBeLessThanOrEqual(d.workload!.additionalUpkeepBudget);
      expect(d.fatigue).toBeLessThanOrEqual(getFatigueThreshold(d.dayOfWeek) + 1e-9);
    }
  });
  it('does not borrow cleaning time when explicitly separate upkeep has zero allowance', () => {
    const p = generateWeekPlan({...base, upkeepTime:{mode:'separate',additionalDayBudgets:[0,0,0,0,0,0,0]}});
    expect(p.metadata.workload!.upkeepMinutes).toBe(0);
    expect(p.metadata.workload!.outcomes.find(o=>o.taskId==='dishes')!.missingDays).toEqual([0,1,2,3,4,5,6]);
    expect(p.metadata.workload!.cleaningMinutes).toBeGreaterThan(0);
    expect(p.metadata.workload!.totalMinutes).toBeLessThanOrEqual(210);
  });
  it.each([undefined, [], [20], [Infinity,0,0,0,0,0,0], [-1,0,0,0,0,0,0], [0.5,0,0,0,0,0,0], [181,0,0,0,0,0,0]])('rejects an absent/invalid extra allowance (%j)', value => {
    expect(()=>generateWeekPlan({...base,upkeepTime:{mode:'separate',additionalDayBudgets:value}} as PlannerInput)).toThrow(RangeError);
  });
  it('rejects an unknown mode and combined capacity over 180 or extra time on no-go days', () => {
    expect(()=>generateWeekPlan({...base,upkeepTime:{mode:'automatic'}} as unknown as PlannerInput)).toThrow(RangeError);
    expect(()=>generateWeekPlan({...base,dayBudgets:[180,0,0,0,0,0,0],upkeepTime:{mode:'separate',additionalDayBudgets:[1,0,0,0,0,0,0]}})).toThrow(RangeError);
    expect(()=>generateWeekPlan({...base,noGoDays:[1],upkeepTime:{mode:'separate',additionalDayBudgets:[1,0,0,0,0,0,0]}})).toThrow(RangeError);
  });
  it('handles zero supply, invalid explicit numbers and the 180m cap without invented work', () => {
    const zero=generateWeekPlan({...base,profile:{weeklyHours:0}});
    expect(zero.metadata.totalMinutesPlanned).toBe(0);
    expect(zero.metadata.workload!.outcomes.filter(o=>o.essential>0).every(o=>o.scheduled===0)).toBe(true);
    const capped=generateWeekPlan({...base,dayBudgets:[NaN,Infinity,-1,181,200,0,0]});
    expect(capped.days.map(d=>d.budget)).toEqual([0,0,0,180,180,0,0]);
    expect(capped.days.every(d=>d.totalMinutes<=d.budget)).toBe(true);
  });
});

describe('truthful scope and model improvements', () => {
  it('uses household work scope rather than stacked size/kid/pet/bathroom multipliers', () => {
    const h=householdTasks(scenarios[7]!.input);
    expect(h.find(t=>t.id==='dishes')!.work!.minutes).toBe(10);
    expect(h.find(t=>t.id==='quick-bathroom-wipe')!.work).toMatchObject({minutes:12,scope:'All 3 bathrooms'});
    expect(h.find(t=>t.id==='clean-shower-tub')!.work!.minutes).toBe(36);
    const small=householdTasks({...base,homeSize:'S'}),large=householdTasks({...base,homeSize:'XL'});
    expect(small.find(t=>t.id==='dishes')!.work!.minutes).toBe(large.find(t=>t.id==='dishes')!.work!.minutes);
    expect(small.find(t=>t.id==='mop-kitchen-floor')!.work!.minutes).toBeLessThan(large.find(t=>t.id==='mop-kitchen-floor')!.work!.minutes);
  });
  it('gives a two-adult household real maintenance across five cleaning categories, not just dishes', () => {
    const p=generateWeekPlan(base);
    const categories=new Set(p.days.flatMap(d=>d.tasks).filter(t=>t.task.work?.kind==='cleaning').map(t=>t.task.work!.category));
    for (const category of ['kitchen','bathroom','floors','laundry','bedroom']) expect(categories.has(category as never)).toBe(true);
    expect(p.metadata.workload!.cleaningMinutes).toBeGreaterThan(p.metadata.workload!.upkeepMinutes);
  });
  it('reports the exact missed low-weekday cat care instead of moving it invisibly to weekends', () => {
    const p=generateWeekPlan(scenarios[6]!.input);
    expect(p.metadata.workload!.outcomes.find(o=>o.taskId==='dishes')!.scheduled).toBe(7);
    expect(p.metadata.workload!.outcomes.find(o=>o.taskId==='litter-box-scoop')!.missingDays).toEqual([3,4]);
    for (const d of p.days) expect(d.tasks.filter(t=>t.task.id==='litter-box-scoop').length).toBeLessThanOrEqual(1);
  });
  it.each(scenarios)('$id reports final placements, not pre-packing intentions, for every due task', ({input}) => {
    const p=generateWeekPlan(input);
    for (const o of p.metadata.workload!.outcomes) {
      const actual=p.days.flatMap(d=>d.tasks).filter(t=>t.task.id===o.taskId).length;
      expect(o.scheduled).toBe(actual);
      if (actual<o.target) expect(p.metadata.pressure.trimmed).toContainEqual({taskId:o.taskId,title:o.title,from:o.target,to:actual});
      else expect(o.reason).toBeNull();
      for (const a of o.alternatives) {
        expect(a.scheduled).toBe(p.days.flatMap(d=>d.tasks).filter(t=>t.task.id===a.taskId).length);
        expect(a.taskId).not.toBe(o.taskId);expect(o.scheduled).toBe(0);
      }
    }
  });
  it('does not call one bathroom the completion of the full household hygiene task', () => {
    const p=generateWeekPlan(scenarios[3]!.input),o=p.metadata.workload!.outcomes.find(o=>o.taskId==='quick-bathroom-wipe')!;
    expect(o.scheduled).toBe(0);expect(o.essential).toBe(1);
    expect(o.alternatives).toEqual([expect.objectContaining({taskId:'p2-bathroom-wipe-one',scheduled:1})]);
    const rotation=advanceRotation({lastDone:{},memberAssignments:{}},['p2-bathroom-wipe-one'],p.weekOf);
    expect(rotation.lastDone['quick-bathroom-wipe']).toBeUndefined();
    expect(rotation.lastDone['p2-bathroom-wipe-one']).toBeDefined();
  });
  it('keeps exact custom durations, never splits oversized tasks, and refuses duplicate identities', () => {
    const huge={...custom,id:'custom-huge',typicalMinutes:{S:480,M:480,L:480,XL:480}};
    const p=generateWeekPlan({...scenarios[7]!.input,profile:{weeklyHours:9},customTasks:[custom,huge]});
    const placed=p.days.flatMap(d=>d.tasks).filter(t=>t.task.id===custom.id);
    expect(placed).toHaveLength(1);expect(placed[0]!.estimatedMinutes).toBe(17);
    expect(p.metadata.unscheduledCustomTasks).toContainEqual(expect.objectContaining({taskId:huge.id,estimatedMinutes:480,reason:'daily_budget'}));
    expect(p.days.flatMap(d=>d.tasks).some(t=>t.task.work?.alternativeFor===huge.id)).toBe(false);
    expect(()=>generateWeekPlan({...base,customTasks:[{...custom,id:'dishes'}]})).toThrow('Task IDs must be unique');
  });
  it('does not resurrect a recently completed full task through a newly introduced alternative', () => {
    const p=generateWeekPlan({...base,rotationState:{lastDone:{'change-bed-sheets':'2026-11-01'},memberAssignments:{}}});
    expect(p.days.flatMap(d=>d.tasks).some(t=>t.task.id==='change-bed-sheets'||t.task.work?.alternativeFor==='change-bed-sheets')).toBe(false);
  });
});
