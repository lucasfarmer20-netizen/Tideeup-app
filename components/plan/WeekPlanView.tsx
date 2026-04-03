'use client';

import { useState, useEffect, useCallback } from 'react';
import { Printer, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DayCard } from './DayCard';
import { SpilloverList } from './SpilloverList';
import { LockedFeature } from './LockedFeature';
import type { WeekPlan } from '@/lib/engine/types.js';
import { deserializeWeekPlan } from '@/utils/serialize';
import type { SerializedWeekPlan } from '@/utils/serialize';

interface WeekPlanViewProps {
  plan: WeekPlan | SerializedWeekPlan;
  planId?: string;
  /** When true the plan content is blurred — used on the result/reveal page */
  isBlurred?: boolean;
  /** Paid tier: household member names for task assignment */
  members?: string[];
  isPaid?: boolean;
}

const SEASON_EMOJI: Record<string, string> = {
  spring: '🌸', summer: '☀️', fall: '🍂', winter: '❄️',
};

function formatWeekRange(weekOf: Date): string {
  const end = new Date(weekOf);
  end.setUTCDate(end.getUTCDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${weekOf.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

function getWeekOf(plan: WeekPlan): Date {
  // weekOf may be a Date or a string (after sessionStorage round-trip)
  return plan.weekOf instanceof Date ? plan.weekOf : new Date(plan.weekOf as unknown as string);
}

function getDayDate(day: WeekPlan['days'][number]): Date {
  return day.date instanceof Date ? day.date : new Date(day.date as unknown as string);
}

function isToday(day: WeekPlan['days'][number]): boolean {
  const d = getDayDate(day);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getFullYear() &&
    d.getUTCMonth() === now.getMonth() &&
    d.getUTCDate() === now.getDate()
  );
}

export function WeekPlanView({ plan: rawPlan, planId, isBlurred = false, members, isPaid = false }: WeekPlanViewProps) {
  const plan: WeekPlan = 'weekOf' in rawPlan && rawPlan.weekOf instanceof Date
    ? rawPlan as WeekPlan
    : deserializeWeekPlan(rawPlan as SerializedWeekPlan);
  const weekOf = getWeekOf(plan);
  const season = plan.metadata.season;

  // Assignments: taskId -> memberName
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!planId || !isPaid || !members?.length) return;
    fetch(`/api/plan/${planId}/assignments`)
      .then((r) => r.json())
      .then((data: { assignments?: { task_id: string; member_name: string }[] }) => {
        const map: Record<string, string> = {};
        for (const a of data.assignments ?? []) map[a.task_id] = a.member_name;
        setAssignments(map);
      })
      .catch(() => null);
  }, [planId, isPaid, members]);

  const handleAssign = useCallback((taskId: string, member: string | null) => {
    setAssignments((prev) => {
      const next = { ...prev };
      if (member === null) delete next[taskId];
      else next[taskId] = member;
      return next;
    });
    if (planId) {
      fetch(`/api/plan/${planId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, memberName: member }),
      }).catch(() => null);
    }
  }, [planId]);

  return (
    <div className="space-y-6">
      {/* Week header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Week of {formatWeekRange(weekOf)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {SEASON_EMOJI[season] ?? ''} {season.charAt(0).toUpperCase() + season.slice(1)}
            </Badge>
            <Badge variant="muted">
              {plan.metadata.totalTasksScheduled} tasks
            </Badge>
            <Badge variant="muted">
              ~{Math.round(plan.metadata.totalMinutesPlanned / 60)}h total
            </Badge>
          </div>
        </div>

        {planId && !isBlurred && (
          <Button
            variant="outline"
            size="sm"
            className="no-print"
            onClick={() => window.open(`/print/${planId}`, '_blank')}
          >
            <Printer className="w-4 h-4" />
            Print
          </Button>
        )}
      </div>

      {/* 7-day grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {plan.days.map((day, i) => (
          <DayCard
            key={i}
            day={day}
            isToday={isToday(day)}
            {...(isPaid && members?.length ? { members, onAssign: handleAssign } : {})}
            assignments={assignments}
          />
        ))}
      </div>

      {/* Spillover */}
      {!isBlurred && plan.spillover.length > 0 && (
        <SpilloverList tasks={plan.spillover} />
      )}

      {/* Locked feature gates — only for free users */}
      {!isBlurred && !isPaid && (
        <div className="grid gap-4 sm:grid-cols-2">
          <LockedFeature feature="rotation_memory" />
          <LockedFeature feature="member_assignment" />
          <LockedFeature feature="sunday_email" />
          <LockedFeature feature="custom_tasks" />
        </div>
      )}
    </div>
  );
}
