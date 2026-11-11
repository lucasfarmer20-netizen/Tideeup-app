'use client';

import Link from 'next/link';

export function PrintActions({ planId }: { planId: string }) {
  return (
    <div className="no-print max-w-3xl mx-auto px-6 pt-4 flex flex-wrap items-center justify-between gap-3">
      <Link
        href={`/plan/${planId}`}
        className="inline-flex min-h-[44px] items-center text-sm text-primary hover:underline"
      >
        ← Back to plan
      </Link>
      <button
        onClick={() => window.print()}
        className="min-h-[44px] bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium shadow"
      >
        Print / Save PDF
      </button>
    </div>
  );
}
