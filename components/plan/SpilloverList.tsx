import Link from 'next/link';
import { AlertCircle, Sparkles } from 'lucide-react';
import type { Task } from '@/lib/engine/types.js';

interface SpilloverListProps {
  tasks: Task[];
  isPaid?: boolean;
}

export function SpilloverList({ tasks, isPaid = false }: SpilloverListProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 space-y-3">
      <div className="flex items-center gap-2 text-accent-strong">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <p className="text-sm font-semibold">
          Didn&apos;t fit this week ({tasks.length} task{tasks.length > 1 ? 's' : ''})
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        These are worth doing in your home, but we held them back to keep each day inside the time you gave us.
      </p>
      <ul className="space-y-1.5">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-2 text-sm text-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            {task.title}
          </li>
        ))}
      </ul>

      {!isPaid && (
        <div className="pt-2 border-t border-accent/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-xs text-foreground/85 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>
              On the free plan each week starts fresh. <strong>Pro</strong> remembers these and puts them first next week.
            </span>
          </p>
          <Link
            href="/pricing"
            className="text-xs font-semibold text-primary hover:underline shrink-0"
          >
            Unlock rotation →
          </Link>
        </div>
      )}
    </div>
  );
}
