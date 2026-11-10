'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Printer, CalendarDays, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DayCard } from './DayCard';
import { SpilloverList } from './SpilloverList';
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
  /** Home size for accurate time estimates in spillover list */
  homeSize?: import('@/lib/engine/types.js').HomeSize;
  /** True when the viewer is the authenticated owner of this plan (persists completions to DB). */
  canComplete?: boolean;
}

/** Optional beta feedback form. The link only renders when this is set. */
const FEEDBACK_URL = process.env.NEXT_PUBLIC_FEEDBACK_URL;

const SEASON_EMOJI: Record<string, string> = {
  spring: '🌸', summer: '☀️', fall: '🍂', winter: '❄️',
};

function formatWeekRange(weekOf: Date): string {
  const end = new Date(weekOf);
  end.setUTCDate(end.getUTCDate() + 6);
  // Plan dates are calendar markers stored at UTC midnight. Format them in UTC
  // so a viewer west of Greenwich does not see the week start a day early.
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  return `${weekOf.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

function getWeekOf(plan: WeekPlan): Date {
  // weekOf may be a Date or a string (after sessionStorage round-trip)
  return plan.weekOf instanceof Date ? plan.weekOf : new Date(plan.weekOf as unknown as string);
}

function getDayDate(day: WeekPlan['days'][number]): Date {
  return day.date instanceof Date ? day.date : new Date(day.date as unknown as string);
}

/** Calendar key (YYYYMMDD as a number) of a plan day, read from its UTC marker. */
function dayKey(day: WeekPlan['days'][number]): number {
  const d = getDayDate(day);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

/** The viewer's own calendar date, in the same key form. */
function localTodayKey(): number {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

function localStorageCompletionKey(planId: string): string {
  return `tideeup_completions_${planId}`;
}

export function WeekPlanView({
  plan: rawPlan,
  planId,
  isBlurred = false,
  members,
  isPaid = false,
  homeSize,
  canComplete = false,
}: WeekPlanViewProps) {
  const plan: WeekPlan = 'weekOf' in rawPlan && rawPlan.weekOf instanceof Date
    ? rawPlan as WeekPlan
    : deserializeWeekPlan(rawPlan as SerializedWeekPlan);
  const weekOf = getWeekOf(plan);
  const season = plan.metadata.season;

  // Allow interactive checkboxes on ALL revealed plans:
  // - Authenticated owners save to DB (`/api/plan/[planId]/completions`)
  // - Anonymous/free viewers save to `localStorage` so they get immediate utility
  const showCompletion = Boolean(planId && !isBlurred);
  const totalTasks = plan.days.reduce((sum, d) => sum + d.tasks.length, 0);
  // A daily chore counts once here, not seven times.
  const distinctTasks = new Set(plan.days.flatMap((d) => d.tasks.map((t) => t.task.id))).size;

  // "Today" is the viewer's own calendar day, known only in the browser, so it
  // is set after mount to keep server and client markup identical.
  const [todayKey, setTodayKey] = useState<number | null>(null);
  useEffect(() => setTodayKey(localTodayKey()), []);
  const startedMidWeek = todayKey !== null && plan.days.some((d) => dayKey(d) < todayKey) && plan.days.some((d) => dayKey(d) >= todayKey);

  // Per-task completion: keys are `${dayIndex}:${taskId}`.
  const [completedKeys, setCompletedKeys] = useState<Set<string>>(new Set());
  const [weekComplete, setWeekComplete] = useState(false);

  useEffect(() => {
    if (!showCompletion || !planId) return;

    // 1. Load local fallback immediately for instant UI response
    try {
      const stored = localStorage.getItem(localStorageCompletionKey(planId));
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed)) {
          setCompletedKeys(new Set(parsed));
        }
      }
    } catch {
      // Ignore storage errors
    }

    // 2. If authenticated owner, sync from server DB
    if (!canComplete) return;
    fetch(`/api/plan/${planId}/completions`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { completions?: { taskId: string; dayIndex: number }[] } | null) => {
        if (!data?.completions) return;
        const nextSet = new Set(data.completions.map((c) => `${c.dayIndex}:${c.taskId}`));
        setCompletedKeys(nextSet);
        try {
          localStorage.setItem(localStorageCompletionKey(planId), JSON.stringify([...nextSet]));
        } catch {
          // Ignore
        }
      })
      .catch(() => null);
  }, [planId, showCompletion, canComplete]);

  const handleToggleTask = useCallback(
    (dayIndex: number, taskId: string, done: boolean) => {
      const key = `${dayIndex}:${taskId}`;
      setCompletedKeys((prev) => {
        const next = new Set(prev);
        if (done) next.add(key);
        else next.delete(key);
        if (planId) {
          try {
            localStorage.setItem(localStorageCompletionKey(planId), JSON.stringify([...next]));
          } catch {
            // Ignore
          }
        }
        if (totalTasks > 0 && next.size >= totalTasks) {
          setWeekComplete(true);
        }
        return next;
      });
      if (!planId || !canComplete) return;
      fetch(`/api/plan/${planId}/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, dayIndex, done }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { autoCompleted?: boolean } | null) => {
          if (data?.autoCompleted) setWeekComplete(true);
        })
        .catch(() => null);
    },
    [planId, canComplete, totalTasks],
  );

  const completedCount = completedKeys.size;
  const progressPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

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

  const hoursPlanned = (plan.metadata.totalMinutesPlanned / 60).toFixed(1).replace(/\.0$/, '');

  return (
    <div className="space-y-6">
      {/* Week header — kept crisp even when the grid below is blurred on the email gate */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Week of {formatWeekRange(weekOf)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {SEASON_EMOJI[season] ?? ''} {season.charAt(0).toUpperCase() + season.slice(1)} schedule
            </Badge>
            <Badge variant="muted">
              {distinctTasks} tasks tailored to your home
            </Badge>
            <Badge variant="muted">
              ~{hoursPlanned}h total across 7 days
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
            Print fridge sheet
          </Button>
        )}
      </div>

      {/* Interactive weekly progress bar */}
      {showCompletion && (
        <div className="rounded-xl border bg-card p-4 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {weekComplete
                ? '🎉 Week complete — nice work!'
                : completedCount === 0
                  ? 'Tap any task below to check it off'
                  : `${completedCount} of ${totalTasks} check-offs done`}
            </span>
            <span className="text-muted-foreground font-medium">{progressPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Contextual Pro nudge once a free user starts checking off tasks */}
          {!isPaid && completedCount > 0 && (
            <div className="pt-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground border-t border-border/60">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>
                  Want TideeUp to remember what you finished and rotate next Monday&apos;s plan automatically?
                </span>
              </span>
              <Link
                href="/pricing"
                className="font-semibold text-primary hover:underline inline-flex items-center gap-1 shrink-0"
              >
                Unlock Pro Rotation
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      )}

      {startedMidWeek && !isBlurred && completedKeys.size === 0 && (
        <p className="text-sm text-muted-foreground no-print">
          You&rsquo;re starting partway through the week, so begin with today. Earlier days are greyed out.
        </p>
      )}

      {/* 7-day grid — blurred only before email reveal */}
      <div
        className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 transition-all duration-700 ${
          isBlurred ? 'blur-md select-none pointer-events-none' : 'blur-0'
        }`}
      >
        {plan.days.map((day, i) => (
          <DayCard
            key={i}
            day={day}
            isToday={todayKey !== null && dayKey(day) === todayKey}
            isPast={todayKey !== null && dayKey(day) < todayKey}
            {...(isPaid && members?.length ? { members, onAssign: handleAssign } : {})}
            assignments={assignments}
            {...(showCompletion
              ? { dayIndex: i, canComplete: true, completedKeys, onToggleTask: handleToggleTask }
              : {})}
          />
        ))}
      </div>

      {/* Coverage — how much of what the home needs fits in the time given.
          Older saved plans predate the pressure report, so guard for it. */}
      {!isBlurred && plan.metadata.pressure && (plan.metadata.pressure.ratio ?? 0) > 1.15 && (
        <CoverageNote pressure={plan.metadata.pressure} isPaid={isPaid} hasSpillover={plan.spillover.length > 0} />
      )}

      {/* Spillover */}
      {!isBlurred && plan.spillover.length > 0 && (
        <SpilloverList tasks={plan.spillover} isPaid={isPaid} />
      )}

      {/* One Pro summary for free users. The contextual nudges above (after a
          first check-off, and beside what did not fit) carry the rest. */}
      {!isBlurred && !isPaid && (
        <div className="rounded-xl border bg-card p-5 space-y-3 no-print">
          <h3 className="text-base font-semibold">Want next week planned for you?</h3>
          <ul className="grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
            <li>Remembers what you finished and rotates the rest in</li>
            <li>A fresh plan in your inbox every Sunday</li>
            <li>Assign tasks to a partner or kids</li>
            <li>Your own tasks and no-go days</li>
          </ul>
          <Link href="/pricing" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            See TideeUp Pro — $7/mo or $60/yr
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {FEEDBACK_URL && !isBlurred && (
        <p className="text-center text-sm text-muted-foreground no-print">
          Does this plan look right for your home?{' '}
          <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
            Tell us what you think
          </a>
        </p>
      )}
    </div>
  );
}

// ─── Coverage note ────────────────────────────────────────────────────────────

function CoverageNote({
  pressure,
  isPaid,
  hasSpillover,
}: {
  pressure: NonNullable<WeekPlan['metadata']['pressure']>;
  isPaid: boolean;
  hasSpillover: boolean;
}) {
  const haveHours = Math.round((pressure.supplyMinutes / 60) * 10) / 10;
  const trimmedDaily = pressure.trimmed.filter((t) => t.to > 0);

  // States what the week does cover. No percentage and no "hours your home
  // needs": a busy household should not open its first plan to a failing grade.
  return (
    <div className="rounded-xl border bg-card px-4 py-3 text-sm no-print">
      <p className="font-medium">
        Your {haveHours} {haveHours === 1 ? 'hour' : 'hours'} this week go to the daily basics and the jobs that matter most.
      </p>
      <p className="mt-1 text-muted-foreground">
        Not everything fits in that time, and that&rsquo;s normal.
        {trimmedDaily.length > 0 && (
          <>
            {' '}We spread {trimmedDaily.length === 1 ? 'one habit' : `${trimmedDaily.length} habits`} over a few days instead of every day.
          </>
        )}
        {hasSpillover &&
          (isPaid
            ? ' What didn\u2019t fit is listed below and moves to the front of next week.'
            : ' What didn\u2019t fit is listed below.')}
      </p>
    </div>
  );
}
