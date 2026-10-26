'use client';

import { cn } from '@/utils/cn';

export interface Choice<T extends string | number> {
  value: T;
  label: string;
  sub?: string;
}

interface Props<T extends string | number> {
  label: string;
  hint?: string;
  choices: readonly Choice<T>[];
  value: T | T[] | null;
  onSelect: (value: T) => void;
  /** Render as a 2-column grid of cards instead of a pill row. */
  cards?: boolean;
}

/**
 * A labelled row of single- or multi-select pills used for the quiz's
 * secondary questions (bathrooms, floors, distribution, priorities).
 * Pass an array `value` for multi-select; the parent handles toggling.
 */
export function ChoiceRow<T extends string | number>({
  label,
  hint,
  choices,
  value,
  onSelect,
  cards = false,
}: Props<T>) {
  const isSelected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);

  return (
    <div className="space-y-2.5">
      <div className="text-center">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className={cn(cards ? 'grid grid-cols-2 gap-2.5' : 'flex flex-wrap justify-center gap-2')}>
        {choices.map((c) => {
          const selected = isSelected(c.value);
          return (
            <button
              key={String(c.value)}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(c.value)}
              className={cn(
                'transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                cards
                  ? 'rounded-xl border-2 p-3.5 text-left'
                  : 'rounded-pill border-2 px-4 py-2 text-sm min-h-[40px]',
                selected
                  ? 'border-primary bg-primary/5 text-primary font-semibold'
                  : 'border-border bg-card text-foreground hover:border-primary/50',
              )}
            >
              <span className={cn(cards && 'block font-semibold')}>{c.label}</span>
              {cards && c.sub && (
                <span className="block text-xs text-muted-foreground mt-0.5 font-normal">{c.sub}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
