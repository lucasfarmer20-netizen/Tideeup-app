import { describe, it, expect } from 'vitest';
import {
  resolveCadence,
  intervalDays,
  occurrencesThisWeek,
  minOccurrencesThisWeek,
  urgency,
  isProtected,
  weekIndex,
} from '../cadence.js';
import { TASK_LIBRARY } from '../../tasks/library.js';
import type { Task } from '../types.js';

const byId = (id: string): Task => {
  const t = TASK_LIBRARY.find((x) => x.id === id);
  if (!t) throw new Error(`no task ${id}`);
  return t;
};

const MONDAY = new Date('2025-06-09T00:00:00Z');

describe('resolveCadence', () => {
  it('uses explicit cadence from the library', () => {
    expect(resolveCadence(byId('make-beds'))).toEqual({ target: 7, min: 2 });
  });
  it('derives daily → 7/7 when not set', () => {
    const { cadence: _c, ...rest } = byId('dishes');
    const t: Task = rest;
    expect(resolveCadence(t)).toEqual({ target: 7, min: 7 });
  });
  it('derives weekly → 1/0 and monthly → 0.25/0', () => {
    expect(resolveCadence(byId('scrub-toilet'))).toEqual({ target: 1, min: 0 });
    expect(resolveCadence(byId('deep-clean-oven'))).toEqual({ target: 0.25, min: 0 });
  });
  it('intervalDays follows target', () => {
    expect(intervalDays(byId('dishes'))).toBe(1);
    expect(intervalDays(byId('scrub-toilet'))).toBe(7);
    expect(intervalDays(byId('deep-clean-oven'))).toBe(28);
  });
});

describe('occurrencesThisWeek', () => {
  it('daily tasks want 7, weekly want 1', () => {
    expect(occurrencesThisWeek(byId('dishes'), MONDAY, undefined)).toBe(7);
    expect(occurrencesThisWeek(byId('scrub-toilet'), MONDAY, undefined)).toBe(1);
  });

  it('monthly tasks come due roughly a quarter at a time, deterministically', () => {
    const monthly = TASK_LIBRARY.filter((t) => t.frequency === 'monthly');
    const counts = [0, 1, 2, 3].map((w) => {
      const week = new Date(MONDAY.getTime() + w * 7 * 86400000);
      return monthly.filter((t) => occurrencesThisWeek(t, week, undefined) === 1).length;
    });
    // every monthly task is due exactly once across a 4-week cycle
    expect(counts.reduce((a, b) => a + b, 0)).toBe(monthly.length);
    // and the spread is reasonably even (no week carries >50%)
    for (const c of counts) expect(c).toBeLessThanOrEqual(monthly.length / 2);
    // same week → same answer
    expect(occurrencesThisWeek(byId('deep-clean-oven'), MONDAY, undefined))
      .toBe(occurrencesThisWeek(byId('deep-clean-oven'), MONDAY, undefined));
  });

  it('monthly task done recently is not due even in its slot', () => {
    const t = byId('deep-clean-oven');
    const slot = [0, 1, 2, 3]
      .map((w) => new Date(MONDAY.getTime() + w * 7 * 86400000))
      .find((d) => occurrencesThisWeek(t, d, undefined) === 1)!;
    const lastDone = new Date(slot.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    expect(occurrencesThisWeek(t, slot, { lastDone: { [t.id]: lastDone }, memberAssignments: {} })).toBe(0);
  });

  it('monthly task long overdue is due regardless of slot', () => {
    const t = byId('deep-clean-oven');
    const lastDone = new Date(MONDAY.getTime() - 60 * 86400000).toISOString().slice(0, 10);
    expect(occurrencesThisWeek(t, MONDAY, { lastDone: { [t.id]: lastDone }, memberAssignments: {} })).toBe(1);
  });

  it('weekIndex is Monday-aligned and monotonic', () => {
    expect(weekIndex(new Date('1970-01-05T00:00:00Z'))).toBe(0);
    expect(weekIndex(new Date('1970-01-12T00:00:00Z'))).toBe(1);
  });
});

describe('minOccurrencesThisWeek', () => {
  it('caps at ideal and floors at cadence.min', () => {
    expect(minOccurrencesThisWeek(byId('make-beds'), 7)).toBe(2);
    expect(minOccurrencesThisWeek(byId('dishes'), 7)).toBe(7);
    expect(minOccurrencesThisWeek(byId('scrub-toilet'), 1)).toBe(0);
    expect(minOccurrencesThisWeek(byId('scrub-toilet'), 0)).toBe(0);
  });
});

describe('urgency', () => {
  const t = byId('scrub-toilet'); // interval 7
  it('is neutral (1) without rotation state or history', () => {
    expect(urgency(t, MONDAY, undefined)).toBe(1);
    expect(urgency(t, MONDAY, { lastDone: {}, memberAssignments: {} })).toBe(1);
  });
  it('is < 1 when done recently and > 1 when overdue', () => {
    const recent = new Date(MONDAY.getTime() - 3 * 86400000).toISOString().slice(0, 10);
    const overdue = new Date(MONDAY.getTime() - 21 * 86400000).toISOString().slice(0, 10);
    expect(urgency(t, MONDAY, { lastDone: { [t.id]: recent }, memberAssignments: {} })).toBeLessThan(1);
    expect(urgency(t, MONDAY, { lastDone: { [t.id]: overdue }, memberAssignments: {} })).toBe(3);
  });
});

describe('isProtected', () => {
  it('honours the library floor', () => {
    expect(isProtected(byId('dishes'), undefined)).toBe(true);
    expect(isProtected(byId('make-beds'), undefined)).toBe(false);
  });
  it('promotes tasks matching household priorities', () => {
    expect(isProtected(byId('quick-bathroom-wipe'), ['bathrooms'])).toBe(true);
    expect(isProtected(byId('scrub-toilet'), ['bathrooms'])).toBe(false); // daily only for zone priorities
    expect(isProtected(byId('mop-kitchen-floor'), ['floors'])).toBe(true);
    expect(isProtected(byId('litter-box-full-clean'), ['pet-mess'])).toBe(true);
    expect(isProtected(byId('mop-kitchen-floor'), ['clutter'])).toBe(false);
  });
});
