import { describe, it, expect } from 'vitest';
import { detectSeason, getSeasonWeight } from '../seasons.js';

describe('detectSeason', () => {
  it('returns spring for March', () => {
    expect(detectSeason(new Date('2025-03-01T00:00:00Z'))).toBe('spring');
  });
  it('returns spring for May', () => {
    expect(detectSeason(new Date('2025-05-31T00:00:00Z'))).toBe('spring');
  });
  it('returns summer for June', () => {
    expect(detectSeason(new Date('2025-06-01T00:00:00Z'))).toBe('summer');
  });
  it('returns summer for August', () => {
    expect(detectSeason(new Date('2025-08-15T00:00:00Z'))).toBe('summer');
  });
  it('returns fall for September', () => {
    expect(detectSeason(new Date('2025-09-01T00:00:00Z'))).toBe('fall');
  });
  it('returns fall for November', () => {
    expect(detectSeason(new Date('2025-11-30T00:00:00Z'))).toBe('fall');
  });
  it('returns winter for December', () => {
    expect(detectSeason(new Date('2025-12-01T00:00:00Z'))).toBe('winter');
  });
  it('returns winter for January', () => {
    expect(detectSeason(new Date('2025-01-15T00:00:00Z'))).toBe('winter');
  });
  it('returns winter for February', () => {
    expect(detectSeason(new Date('2025-02-28T00:00:00Z'))).toBe('winter');
  });
});

describe('getSeasonWeight', () => {
  it('boosts outdoor in spring', () => {
    expect(getSeasonWeight('outdoor', 'spring')).toBeGreaterThan(1);
  });
  it('suppresses outdoor in winter', () => {
    expect(getSeasonWeight('outdoor', 'winter')).toBeLessThan(1);
  });
  it('returns a positive number for all zone/season combinations', () => {
    const zones = ['kitchen', 'bathroom', 'bedroom', 'living', 'outdoor', 'laundry', 'general'] as const;
    const seasons = ['spring', 'summer', 'fall', 'winter'] as const;
    for (const zone of zones) {
      for (const season of seasons) {
        expect(getSeasonWeight(zone, season)).toBeGreaterThan(0);
      }
    }
  });
  it('boosts outdoor in summer', () => {
    expect(getSeasonWeight('outdoor', 'summer')).toBeGreaterThan(1);
  });
  it('boosts kitchen in winter (holiday cooking)', () => {
    expect(getSeasonWeight('kitchen', 'winter')).toBeGreaterThan(1);
  });
});
