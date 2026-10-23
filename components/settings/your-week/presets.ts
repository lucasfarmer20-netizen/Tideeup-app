export interface DayPreset {
  id: 'work-day' | 'off' | 'busy-evening' | 'reset' | 'nothing';
  label: string;
  minutes: number;
}

/**
 * Five canonical day presets in exact display order from the design brief.
 */
export const DAY_PRESETS: readonly DayPreset[] = [
  { id: 'work-day',     label: 'Work day · 20',     minutes: 20  },
  { id: 'off',          label: 'Off · 60',          minutes: 60  },
  { id: 'busy-evening', label: 'Busy evening · 10', minutes: 10  },
  { id: 'reset',        label: 'Reset · 120',       minutes: 120 },
  { id: 'nothing',      label: 'Nothing · 0',       minutes: 0   },
] as const;

export interface DayMeta {
  index: number;
  short: string;
  full: string;
  isWeekend: boolean;
}

/**
 * Monday-first day metadata (index 0 = Mon … 6 = Sun).
 */
export const DAYS_MONDAY_FIRST: readonly DayMeta[] = [
  { index: 0, short: 'Mon', full: 'Monday',    isWeekend: false },
  { index: 1, short: 'Tue', full: 'Tuesday',   isWeekend: false },
  { index: 2, short: 'Wed', full: 'Wednesday', isWeekend: false },
  { index: 3, short: 'Thu', full: 'Thursday',  isWeekend: false },
  { index: 4, short: 'Fri', full: 'Friday',    isWeekend: false },
  { index: 5, short: 'Sat', full: 'Saturday',  isWeekend: true  },
  { index: 6, short: 'Sun', full: 'Sunday',    isWeekend: true  },
] as const;

export const MAX_DAY_MINUTES = 180;
export const SEGMENT_STEP_MINUTES = 15;
export const SEGMENT_COUNT = 12; // 12 × 15 min = 180 min
