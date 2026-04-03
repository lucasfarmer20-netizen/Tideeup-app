import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TaskRow } from './TaskRow';
import type { DayPlan } from '@/lib/engine/types.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ZONE_COLORS: Record<string, string> = {
  kitchen:  'bg-orange-100 text-orange-700 border-orange-200',
  bathroom: 'bg-blue-100   text-blue-700   border-blue-200',
  bedroom:  'bg-purple-100 text-purple-700  border-purple-200',
  living:   'bg-green-100  text-green-700   border-green-200',
  outdoor:  'bg-lime-100   text-lime-700    border-lime-200',
  laundry:  'bg-sky-100    text-sky-700     border-sky-200',
  general:  'bg-slate-100  text-slate-700   border-slate-200',
};

function getPrimaryZone(day: DayPlan): string {
  if (day.tasks.length === 0) return 'general';
  // Most-represented zone (excluding daily stabilisers tagged as general)
  const counts = new Map<string, number>();
  for (const t of day.tasks) {
    if (t.task.frequency !== 'daily') {
      counts.set(t.zone, (counts.get(t.zone) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return 'general';
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'general';
}

interface DayCardProps {
  day: DayPlan;
  isToday?: boolean;
  members?: string[];
  assignments?: Record<string, string>;
  onAssign?: (taskId: string, member: string | null) => void;
}

export function DayCard({ day, isToday = false, members, assignments, onAssign }: DayCardProps) {
  const dayName = FULL_DAY_NAMES[day.dayOfWeek] ?? 'Unknown';
  const shortName = DAY_NAMES[day.dayOfWeek] ?? '?';
  const zone = getPrimaryZone(day);
  const zoneColor = ZONE_COLORS[zone] ?? ZONE_COLORS.general!;

  // Split into daily stabilisers and "feature" tasks
  const stabilisers = day.tasks.filter((t) => t.task.frequency === 'daily');
  const featured = day.tasks.filter((t) => t.task.frequency !== 'daily');
  const isEmpty = day.tasks.length === 0;

  return (
    <div
      className={`rounded-xl border bg-card shadow-sm overflow-hidden ${isToday ? 'ring-2 ring-primary' : ''}`}
    >
      {/* Day header */}
      <div className="px-4 pt-4 pb-3 border-b flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className={`text-base font-bold ${isToday ? 'text-primary' : ''}`}>
            {dayName}
          </span>
          {isToday && (
            <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
              Today
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isEmpty && (
            <Badge variant="outline" className={`text-xs border ${zoneColor}`}>
              {zone}
            </Badge>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{day.totalMinutes}m</span>
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="px-4 py-2">
        {isEmpty ? (
          <p className="text-sm text-muted-foreground py-2 italic">Rest day — nothing scheduled.</p>
        ) : (
          <>
            {featured.map((t) => (
              <TaskRow
                key={t.task.id}
                scheduledTask={t}
                {...(members ? { members } : {})}
                {...(assignments?.[t.task.id] ? { assignment: assignments[t.task.id] } : {})}
                {...(onAssign ? { onAssign } : {})}
              />
            ))}
            {stabilisers.length > 0 && featured.length > 0 && (
              <Separator className="my-2" />
            )}
            {stabilisers.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">Daily basics</p>
                {stabilisers.map((t) => (
                  <TaskRow
                    key={t.task.id}
                    scheduledTask={t}
                    {...(members ? { members } : {})}
                    {...(assignments?.[t.task.id] ? { assignment: assignments[t.task.id] } : {})}
                    {...(onAssign ? { onAssign } : {})}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
