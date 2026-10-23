'use client';

import * as React from 'react';
import { cn } from '@/utils/cn';
import {
  MAX_DAY_MINUTES,
  SEGMENT_COUNT,
  SEGMENT_STEP_MINUTES,
} from './presets';

export interface SegmentedBarProps {
  value: number;
  onChange: (minutes: number) => void;
  disabled?: boolean | undefined;
  label: string;
}

function clampMinutes(mins: number): number {
  return Math.max(0, Math.min(MAX_DAY_MINUTES, mins));
}

export function SegmentedBar({
  value,
  onChange,
  disabled = false,
  label,
}: SegmentedBarProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  // Number of segments lit (12 segments × 15 min).
  // Supports non-15m preset values (10m -> 1 seg, 20m -> 2 segs) gracefully.
  const filledSegments =
    value <= 0
      ? 0
      : Math.min(SEGMENT_COUNT, Math.ceil(value / SEGMENT_STEP_MINUTES));

  const computeMinutesFromClientX = React.useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const ratio = (clientX - rect.left) / rect.width;
    // Allow scrubbing all the way left (< 4% of track width) to set 0 ("Rest day")
    if (ratio <= 0.04) return 0;
    const rawSegment = Math.ceil(ratio * SEGMENT_COUNT);
    const clampedSegment = Math.max(1, Math.min(SEGMENT_COUNT, rawSegment));
    return clampedSegment * SEGMENT_STEP_MINUTES;
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    // Only primary mouse button or touch/pen
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    const next = computeMinutesFromClientX(e.clientX);
    // If tapping the currently-active top segment (and not dragging), allow toggling to 0 when on segment 1
    if (next === value && value === SEGMENT_STEP_MINUTES) {
      onChange(0);
    } else if (next !== value) {
      onChange(next);
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging || disabled) return;
    const next = computeMinutesFromClientX(e.clientX);
    if (next !== value) {
      onChange(next);
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    // Snap starting point to 15-min grid when using arrow keys from a 10m/20m preset
    const snappedBase = Math.round(value / SEGMENT_STEP_MINUTES) * SEGMENT_STEP_MINUTES;

    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(clampMinutes(snappedBase + SEGMENT_STEP_MINUTES));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(clampMinutes(snappedBase - SEGMENT_STEP_MINUTES));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(MAX_DAY_MINUTES);
    }
    // Number keys are intentionally ignored per spec.
  }

  const valuetext = value === 0 ? 'Rest day (0 minutes)' : `${value} minutes`;

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={`${label} cleaning time`}
      aria-valuemin={0}
      aria-valuemax={MAX_DAY_MINUTES}
      aria-valuenow={value}
      aria-valuetext={valuetext}
      aria-disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative flex items-center gap-1 min-h-[44px] w-full py-2 px-1 rounded-lg select-none touch-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        disabled && 'cursor-default pointer-events-none',
      )}
    >
      {Array.from({ length: SEGMENT_COUNT }).map((_, idx) => {
        const isFilled = idx < filledSegments;
        const isLastFilled = idx === filledSegments - 1;
        return (
          <div
            key={idx}
            className={cn(
              // Brand tokens are plain hex vars, so no `/alpha` modifiers here:
              // Tailwind drops those classes and the segment renders transparent.
              'relative h-7 flex-1 rounded-[4px] overflow-hidden border transition-colors duration-100 motion-reduce:transition-none',
              isFilled
                ? 'bg-sage border-sage'
                : 'bg-surface border-sage-mist group-hover:bg-sage-mist',
            )}
          >
            {/* Thin terracotta accent cap on the last filled segment */}
            {isLastFilled && (
              <span
                aria-hidden
                className="absolute inset-y-0 right-0 w-[3px] bg-accent"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
