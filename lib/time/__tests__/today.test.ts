import { describe, expect, it } from 'vitest';
import { calendarToday } from '../today';

describe('calendarToday', () => {
  // Tuesday 10 Nov 2026, 4pm in Anchorage is already Wednesday 01:00 UTC.
  const lateAfternoonAlaska = new Date('2026-11-11T01:00:00Z');

  it('uses the viewer zone, not UTC, for the day', () => {
    expect(calendarToday('America/Anchorage', lateAfternoonAlaska)).toEqual({ dateISO: '2026-11-10', dow: 2, mondayISO: '2026-11-09' });
    expect(calendarToday(undefined, lateAfternoonAlaska)).toEqual({ dateISO: '2026-11-11', dow: 3, mondayISO: '2026-11-09' });
  });

  it('keeps Sunday evening in the week that is ending', () => {
    const sundayEveningAlaska = new Date('2026-11-16T03:00:00Z'); // Sun 15 Nov, 6pm AKST
    expect(calendarToday('America/Anchorage', sundayEveningAlaska)).toEqual({ dateISO: '2026-11-15', dow: 0, mondayISO: '2026-11-09' });
    expect(calendarToday('UTC', sundayEveningAlaska).mondayISO).toBe('2026-11-16');
  });

  it('falls back to UTC for an invalid zone', () => {
    expect(calendarToday('Not/AZone', lateAfternoonAlaska).dateISO).toBe('2026-11-11');
  });
});
