'use client';

import * as React from 'react';
import { cn } from '@/utils/cn';
import { DAY_PRESETS } from './presets';

export interface PresetChipsProps {
  value: number;
  onSelect: (minutes: number) => void;
  disabled?: boolean | undefined;
  dayLabel: string;
}

export function PresetChips({
  value,
  onSelect,
  disabled = false,
  dayLabel,
}: PresetChipsProps) {
  return (
    <div
      role="group"
      aria-label={`Presets for ${dayLabel}`}
      className="flex flex-wrap items-center gap-1.5"
    >
      {DAY_PRESETS.map((preset) => {
        const isSelected = value === preset.minutes;
        return (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            aria-pressed={isSelected}
            onClick={() => onSelect(preset.minutes)}
            className={cn(
              'rounded-pill px-2.5 py-1 text-xs font-medium leading-none border transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 min-h-[28px]',
              isSelected
                ? 'bg-sage border-sage text-white shadow-sm'
                : 'bg-surface border-sage-mist text-ink hover:bg-sage-mist',
              disabled && 'pointer-events-none opacity-60',
            )}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
