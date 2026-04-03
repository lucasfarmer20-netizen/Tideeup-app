'use client';

import Link from 'next/link';

export function PrintActions({ planId }: { planId: string }) {
  return (
    <div className="no-print fixed top-4 right-4 z-50 flex items-center gap-3">
      <Link
        href={`/plan/${planId}`}
        className="text-sm text-primary hover:underline"
      >
        ← Back to plan
      </Link>
      <button
        onClick={() => window.print()}
        className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium shadow"
      >
        Print / Save PDF
      </button>
    </div>
  );
}
