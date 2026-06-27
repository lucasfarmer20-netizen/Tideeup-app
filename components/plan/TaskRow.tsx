import { Clock, Check } from 'lucide-react';
import type { ScheduledTask } from '@/lib/engine/types.js';

interface TaskRowProps {
  scheduledTask: ScheduledTask;
  members?: string[];
  assignment?: string;
  onAssign?: (taskId: string, member: string | null) => void;
  /** Per-task completion (LTV task 1). When canComplete is set, a checkbox shows. */
  canComplete?: boolean;
  completed?: boolean;
  onToggle?: (done: boolean) => void;
}

export function TaskRow({
  scheduledTask,
  members,
  assignment,
  onAssign,
  canComplete = false,
  completed = false,
  onToggle,
}: TaskRowProps) {
  const { task, estimatedMinutes } = scheduledTask;
  const showAssignment = members && members.length > 0 && onAssign;

  return (
    <div className="flex items-start gap-3 py-2">
      {canComplete ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={completed}
          aria-label={completed ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
          onClick={() => onToggle?.(!completed)}
          className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
            completed
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-muted-foreground/40 hover:border-primary'
          }`}
        >
          {completed && <Check className="w-3 h-3" strokeWidth={3} />}
        </button>
      ) : (
        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-2 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-snug transition-colors ${
            completed ? 'line-through text-muted-foreground' : ''
          }`}
        >
          {task.title}
        </p>
        {showAssignment && (
          <select
            value={assignment ?? ''}
            onChange={(e) => onAssign(task.id, e.target.value || null)}
            className="mt-0.5 text-xs text-muted-foreground bg-transparent border-none outline-none cursor-pointer hover:text-foreground"
          >
            <option value="">— assign to…</option>
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
