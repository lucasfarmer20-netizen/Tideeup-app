import { AlertCircle } from 'lucide-react';
import type { Task } from '@/lib/engine/types.js';

interface SpilloverListProps {
  tasks: Task[];
}

export function SpilloverList({ tasks }: SpilloverListProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-3">
      <div className="flex items-center gap-2 text-amber-700">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <p className="text-sm font-semibold">
          Didn't fit this week ({tasks.length} task{tasks.length > 1 ? 's' : ''})
        </p>
      </div>
      <p className="text-xs text-amber-600">
        These tasks scored for this week but ran over your time budget. They'll be prioritised next week.
      </p>
      <ul className="space-y-1.5">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-2 text-sm text-amber-700">
            <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
            {task.title}
            <span className="text-xs text-amber-500 ml-auto">{task.typicalMinutes.M}m+</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
