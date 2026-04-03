'use client';

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import type { StreakData } from '@/types/api';

interface CompleteWeekButtonProps {
  planId: string;
  onComplete?: (streak: StreakData) => void;
}

export function CompleteWeekButton({ planId, onComplete }: CompleteWeekButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/plan/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? 'Something went wrong');
      }

      const data = (await res.json()) as { streak: StreakData };
      setDone(true);
      onComplete?.(data.streak);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 text-sm text-primary font-medium">
        <CheckCircle className="w-4 h-4" />
        Week marked as done!
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-sm text-muted-foreground hover:text-foreground border rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving…' : '✓ Mark week as done'}
      </button>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
