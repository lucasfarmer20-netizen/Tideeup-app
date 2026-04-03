import { Clock } from 'lucide-react';
import type { ScheduledTask } from '@/lib/engine/types.js';

interface TaskRowProps {
  scheduledTask: ScheduledTask;
  members?: string[];
  assignment?: string;
  onAssign?: (taskId: string, member: string | null) => void;
}

export function TaskRow({ scheduledTask, members, assignment, onAssign }: TaskRowProps) {
  const { task, estimatedMinutes } = scheduledTask;
  const showAssignment = members && members.length > 0 && onAssign;

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-2 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">{task.title}</p>
        {showAssignment && (
          <select
            value={assignment ?? ''}
            onChange={(e) => onAssign(task.id, e.target.value || null)}
            className="mt-0.5 text-xs text-muted-foreground bg-transparent border-none outline-none cursor-pointer hover:text-foreground"
          >
            <option value="">— assign to</option>
            {members.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
        <Clock className="w-3 h-3" />
        <span>{estimatedMinutes}m</span>
      </div>
    </div>
  );
}
