'use client';

import * as React from 'react';
import { cn } from '@/utils/cn';
import { SegmentedBar } from './SegmentedBar';
import { PresetChips } from './PresetChips';
import type { DayMeta } from './presets';

export interface DayRowProps {
  day: DayMeta;
  minutes: number;
  onChange: (minutes: number) => void;
  disabled?: boolean | undefined;
  /** Monday-only helper callback: copies Monday's value to Tue–Fri */
  onCopyToWeekdays?: (() => void) | undefined;
  /** Sunday-only weekly total helper string */
  weeklyTotalCopy?: string | undefined;
}

export function DayRow({
  day,
  minutes,
  onChange,
  disabled = false,
  onCopyToWeekdays,
  weeklyTotalCopy,
}: DayRowProps) {
  const showMondayCopyLink = day.index === 0 && minutes > 0 && Boolean(onCopyToWeekdays);

  return (
    <div
      className={cn(
        'rounded-xl px-3 py-2.5 transition-colors motion-reduce:transition-none space-y-2',
        day.isWeekend ? 'bg-surface-sage' : 'bg-transparent',
      )}
    >
      {/* Main row: Day label + 12-segment bar + tabular readout (+ inline presets on xl desktop) */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {/* Day label: short on mobile, full on desktop */}
          <div className="w-10 lg:w-24 shrink-0">
            <span className="text-sm font-semibold text-ink lg:hidden">
              {day.short}
            </span>
            <span className="hidden lg:inline text-sm font-semibold text-ink">
              {day.full}
            </span>
          </div>

          {/* 12-segment bar */}
          <div className="flex-1 min-w-0">
            <SegmentedBar
              value={minutes}
              onChange={onChange}
              disabled={disabled}
              label={day.full}
            />
          </div>

          {/* Tabular minutes readout */}
          <div className="w-16 sm:w-20 text-right shrink-0">
            <span className="text-xs sm:text-sm font-medium text-ink-muted tabular-nums">
              {minutes === 0 ? 'Rest day' : `${minutes} min`}
            </span>
          </div>
        </div>

        {/* Preset chips: stacked below bar on mobile, inline on large screens */}
        <div className="pl-12 lg:pl-0 shrink-0">
          <PresetChips
            value={minutes}
            onSelect={onChange}
            disabled={disabled}
            dayLabel={day.full}
          />
        </div>
      </div>

      {/* Monday helper: Copy Monday to all weekdays */}
      {showMondayCopyLink && (
        <div className="pl-12 lg:pl-28">
          <button
            type="button"
            disabled={disabled}
            onClick={onCopyToWeekdays}
            className="text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            Copy Monday to all weekdays
          </button>
        </div>
      )}

      {/* Sunday helper: Weekly total */}
      {day.index === 6 && weeklyTotalCopy && (
        <div className="pl-12 lg:pl-28 pt-0.5">
          <p className="text-xs text-ink-muted tabular-nums">
            {weeklyTotalCopy}
          </p>
        </div>
      )}
    </div>
  );
}
