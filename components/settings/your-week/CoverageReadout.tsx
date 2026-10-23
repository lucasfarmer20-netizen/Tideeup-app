import * as React from 'react';

export interface CoverageSummary {
  supplyMinutes: number;
  demandMinutes: number;
  coverage: number; // 0–1
}

export interface CoverageReadoutProps {
  summary: CoverageSummary;
}

function formatDecimalHours(minutes: number): string {
  const hours = Math.max(0, minutes) / 60;
  return hours.toFixed(1).replace(/\.0$/, '');
}

export function CoverageReadout({ summary }: CoverageReadoutProps) {
  const supplyHours = formatDecimalHours(summary.supplyMinutes);
  const demandHours = formatDecimalHours(summary.demandMinutes);
  const clampedCoverage = Math.max(0, Math.min(1, summary.coverage));
  const coveragePct = Math.round(clampedCoverage * 100);
  const isLightWeek = clampedCoverage < 0.4;

  return (
    <div className="w-full lg:w-80 shrink-0 rounded-xl border border-border/80 bg-background/60 p-3.5 space-y-2">
      <p className="text-xs font-medium text-ink tabular-nums">
        {supplyHours} h set aside · {demandHours} h needed · covers {coveragePct}%
      </p>

      {/* Slim coverage bar — always calm sage, never red/amber */}
      <div
        role="progressbar"
        aria-valuenow={coveragePct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Weekly cleaning coverage"
        className="h-2 w-full rounded-pill bg-sage-mist overflow-hidden"
      >
        <div
          className="h-full rounded-pill bg-sage transition-all duration-200 motion-reduce:transition-none"
          style={{ width: `${coveragePct}%` }}
        />
      </div>

      {isLightWeek && (
        <p className="text-xs text-ink-muted leading-snug pt-0.5">
          Lighter weeks are fine — essentials stay in, the rest rotates back.
        </p>
      )}
    </div>
  );
}
