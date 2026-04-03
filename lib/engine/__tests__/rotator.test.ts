import { describe, it, expect } from 'vitest';
import { isEligible, filterByRotation, advanceRotation, assignToMembers } from '../rotator.js';
import { TASK_LIBRARY } from '../../tasks/library.js';
import type { RotationState, Task } from '../types.js';

const weekOf = new Date('2025-06-09T00:00:00Z'); // a Monday

// Use task IDs that exist in the rebuilt library
const dishes        = TASK_LIBRARY.find((t) => t.id === 'dishes')!;
const laundryWash   = TASK_LIBRARY.find((t) => t.id === 'laundry-wash-dry')!;
const deepCleanOven = TASK_LIBRARY.find((t) => t.id === 'deep-clean-oven')!;

function makeState(lastDone: Record<string, string> = {}): RotationState {
  return { lastDone, memberAssignments: {} };
}

describe('isEligible', () => {
  it('returns true when no rotation state is provided', () => {
    expect(isEligible(laundryWash, weekOf, undefined)).toBe(true);
  });

  it('returns true when task has never been done', () => {
    expect(isEligible(laundryWash, weekOf, makeState())).toBe(true);
  });

  it('returns false for weekly task done 3 days ago', () => {
    const state = makeState({ [laundryWash.id]: '2025-06-06' }); // 3 days ago
    expect(isEligible(laundryWash, weekOf, state)).toBe(false);
  });

  it('returns true for weekly task done 6 days ago', () => {
    const state = makeState({ [laundryWash.id]: '2025-06-03' }); // 6 days ago
    expect(isEligible(laundryWash, weekOf, state)).toBe(true);
  });

  it('returns false for monthly task done 10 days ago', () => {
    const state = makeState({ [deepCleanOven.id]: '2025-05-30' }); // 10 days ago
    expect(isEligible(deepCleanOven, weekOf, state)).toBe(false);
  });

  it('returns true for monthly task done 22 days ago', () => {
    const state = makeState({ [deepCleanOven.id]: '2025-05-18' }); // 22 days ago
    expect(isEligible(deepCleanOven, weekOf, state)).toBe(true);
  });

  it('daily tasks are always eligible regardless of lastDone', () => {
    const state = makeState({ [dishes.id]: '2025-06-09' }); // today
    expect(isEligible(dishes, weekOf, state)).toBe(true);
  });

  it('returns true for malformed date (safe fallback)', () => {
    const state = makeState({ [laundryWash.id]: 'not-a-date' });
    expect(isEligible(laundryWash, weekOf, state)).toBe(true);
  });
});

describe('filterByRotation', () => {
  it('returns all tasks when no rotation state', () => {
    const result = filterByRotation(TASK_LIBRARY, weekOf, undefined);
    expect(result).toHaveLength(TASK_LIBRARY.length);
  });

  it('excludes recently-done weekly tasks', () => {
    const state = makeState({ [laundryWash.id]: '2025-06-07' }); // 2 days ago
    const result = filterByRotation([laundryWash], weekOf, state);
    expect(result).toHaveLength(0);
  });

  it('includes all eligible tasks', () => {
    const state = makeState({ [laundryWash.id]: '2025-06-01' }); // 8 days ago
    const result = filterByRotation([laundryWash], weekOf, state);
    expect(result).toHaveLength(1);
  });

  it('preserves tasks not in the lastDone map', () => {
    const state = makeState({ [laundryWash.id]: '2025-06-07' }); // exclude laundry
    const result = filterByRotation([dishes, laundryWash], weekOf, state);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('dishes');
  });
});

describe('advanceRotation', () => {
  it('records done tasks with the weekOf date', () => {
    const initial = makeState();
    const updated = advanceRotation(initial, ['dishes', 'laundry-wash-dry'], weekOf);
    expect(updated.lastDone['dishes']).toBe('2025-06-09');
    expect(updated.lastDone['laundry-wash-dry']).toBe('2025-06-09');
  });

  it('preserves existing lastDone entries', () => {
    const initial = makeState({ [deepCleanOven.id]: '2025-05-01' });
    const updated = advanceRotation(initial, ['dishes'], weekOf);
    expect(updated.lastDone[deepCleanOven.id]).toBe('2025-05-01');
    expect(updated.lastDone['dishes']).toBe('2025-06-09');
  });

  it('overwrites lastDone when task is repeated', () => {
    const initial = makeState({ [dishes.id]: '2025-06-02' });
    const updated = advanceRotation(initial, [dishes.id], weekOf);
    expect(updated.lastDone[dishes.id]).toBe('2025-06-09');
  });

  it('handles empty doneIds gracefully', () => {
    const initial = makeState({ [dishes.id]: '2025-06-01' });
    const updated = advanceRotation(initial, [], weekOf);
    expect(updated.lastDone[dishes.id]).toBe('2025-06-01'); // unchanged
  });
});

describe('assignToMembers', () => {
  const initial = makeState();

  it('distributes tasks evenly across members', () => {
    const updated = assignToMembers(initial, ['t1', 't2', 't3', 't4'], ['alice', 'bob']);
    expect(updated.memberAssignments['alice']).toEqual(['t1', 't3']);
    expect(updated.memberAssignments['bob']).toEqual(['t2', 't4']);
  });

  it('handles single member', () => {
    const updated = assignToMembers(initial, ['t1', 't2'], ['alice']);
    expect(updated.memberAssignments['alice']).toEqual(['t1', 't2']);
  });

  it('returns unchanged state when no members', () => {
    const updated = assignToMembers(initial, ['t1'], []);
    expect(updated.memberAssignments).toEqual({});
  });

  it('handles more members than tasks', () => {
    const updated = assignToMembers(initial, ['t1'], ['alice', 'bob', 'carol']);
    const allAssigned = Object.values(updated.memberAssignments).flat();
    expect(allAssigned).toContain('t1');
    expect(allAssigned).toHaveLength(1);
  });

  it('handles empty task list', () => {
    const updated = assignToMembers(initial, [], ['alice', 'bob']);
    expect(updated.memberAssignments['alice']).toEqual([]);
    expect(updated.memberAssignments['bob']).toEqual([]);
  });
});
