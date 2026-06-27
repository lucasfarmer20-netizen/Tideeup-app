import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Printer, RefreshCw, ArrowRight, Flame } from 'lucide-react';
import { getServerUser } from '@/lib/supabase/session.js';
import { createAdminClient } from '@/lib/supabase/server.js';
import { CompleteWeekButton } from '@/components/dashboard/CompleteWeekButton';
import { UpgradedBanner } from '@/components/dashboard/UpgradedBanner';
import { ProgressRing } from '@/components/dashboard/ProgressRing';
import { streakMilestone, formatHours } from '@/lib/stats/milestones.js';
import type { SerializedWeekPlan, SerializedDayPlan } from '@/utils/serialize';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentMondayISO(): string {
  const now = new Date();
  const dow = now.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function getTodayDow(): number {
  return new Date().getUTCDay();
}

function getPrimaryZone(day: SerializedDayPlan): string {
  const counts = new Map<string, number>();
  for (const t of day.tasks) {
    if (t.task.frequency !== 'daily') {
      counts.set(t.zone, (counts.get(t.zone) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return 'general';
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'general';
}

function getTimeRemaining(day: SerializedDayPlan): number {
  return day.budget - day.totalMinutes;
}

const ZONE_LABEL: Record<string, string> = {
  kitchen: 'Kitchen', bathroom: 'Bathroom', bedroom: 'Bedroom',
  living: 'Living Room', outdoor: 'Outdoor', laundry: 'Laundry', general: 'General',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string; planId?: string }>;
}) {
  const { upgraded, planId: specificPlanId } = await searchParams;
  const authUser = await getServerUser();
  if (!authUser?.email) notFound();

  const supabase = createAdminClient();
  const mondayISO = getCurrentMondayISO();
  const todayDow = getTodayDow();

  const { data: user } = await supabase
    .from('users')
    .select('id, tier')
    .eq('email', authUser.email)
    .single();

  let currentPlan: { id: string; week_plan: SerializedWeekPlan } | null = null;
  let streakCount = 0;
  let longestStreak = 0;

  // Cumulative progress stats (LTV task 2)
  let lifetimeTasks = 0;
  let lifetimeMinutes = 0;
  let weekCompletedCount = 0;

  let members: string[] = [];
  let assignments: Record<string, string> = {};
  let seasonOverride: string | null = null;
  let rotationLastDone: Record<string, string> = {};

  if (user) {
    // If a specific planId was passed (e.g. right after quiz completion), load
    // that plan directly so it's visible immediately regardless of week_of timing.
    const planQuery = specificPlanId
      ? supabase.from('plans').select('id, week_plan').eq('user_id', user.id).eq('id', specificPlanId).maybeSingle()
      : supabase.from('plans').select('id, week_plan').eq('user_id', user.id).eq('week_of', mondayISO).order('created_at', { ascending: false }).limit(1).maybeSingle();

    const [planRes, streakRes, householdRes, completionRes] = await Promise.all([
      planQuery,
      supabase
        .from('streaks')
        .select('current_streak, longest_streak')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('households')
        .select('members, season_override, rotation_state')
        .eq('user_id', user.id)
        .maybeSingle(),
      // Lifetime check-offs for cumulative stats (LTV task 2).
      supabase
        .from('task_completions')
        .select('plan_id, minutes')
        .eq('user_id', user.id),
    ]);

    currentPlan = planRes.data as { id: string; week_plan: SerializedWeekPlan } | null;
    streakCount = streakRes.data?.current_streak ?? 0;
    longestStreak = (streakRes.data as { longest_streak?: number } | null)?.longest_streak ?? 0;
    members = (householdRes.data as { members?: string[] } | null)?.members ?? [];
    seasonOverride = (householdRes.data as { season_override?: string | null } | null)?.season_override ?? null;
    rotationLastDone =
      (householdRes.data as { rotation_state?: { lastDone?: Record<string, string> } | null } | null)
        ?.rotation_state?.lastDone ?? {};

    const completionRows = (completionRes.data ?? []) as { plan_id: string; minutes: number }[];
    lifetimeTasks = completionRows.length;
    lifetimeMinutes = completionRows.reduce((sum, r) => sum + (r.minutes ?? 0), 0);
    if (currentPlan) {
      weekCompletedCount = completionRows.filter((r) => r.plan_id === currentPlan!.id).length;
    }

    // Load today's assignments for member grouping
    if (currentPlan && members.length > 0) {
      const { data: assignRows } = await supabase
        .from('task_assignments')
        .select('task_id, member_name')
        .eq('plan_id', currentPlan.id);
      for (const a of assignRows ?? []) {
        assignments[(a as { task_id: string }).task_id] = (a as { member_name: string }).member_name;
      }
    }
  }

  const isPaid = (user as { tier?: string } | null)?.tier === 'paid';
  const todayPlan = currentPlan
    ? (currentPlan.week_plan.days.find((d) => d.dayOfWeek === todayDow) ?? null)
    : null;

  const todayName = DAY_NAMES[todayDow] ?? 'Today';
  const primaryZone = todayPlan ? getPrimaryZone(todayPlan) : null;
  const timeRemaining = todayPlan ? getTimeRemaining(todayPlan) : 0;
  const season = currentPlan?.week_plan.metadata.season ?? null;
  const seasonLabel = seasonOverride
    ? `${seasonOverride.charAt(0).toUpperCase() + seasonOverride.slice(1)} mode`
    : season ? `Auto: ${season.charAt(0).toUpperCase() + season.slice(1)}` : null;

  // Progress layer (LTV task 2)
  const weekTotal = currentPlan
    ? currentPlan.week_plan.days.reduce((sum, d) => sum + d.tasks.length, 0)
    : 0;
  const weekPct = weekTotal > 0 ? Math.round((weekCompletedCount / weekTotal) * 100) : 0;
  const milestone = streakMilestone(streakCount);

  // "Coming back this week" rotation visibility (LTV task 4) — featured tasks in
  // this week's plan that haven't been done in 3+ weeks, longest gap first.
  const comingBack: { title: string; weeksAgo: number }[] = [];
  if (currentPlan && isPaid) {
    const ref = new Date(mondayISO).getTime();
    const seen = new Set<string>();
    for (const day of currentPlan.week_plan.days) {
      for (const t of day.tasks) {
        if (t.task.frequency === 'daily' || seen.has(t.task.id)) continue;
        seen.add(t.task.id);
        const iso = rotationLastDone[t.task.id];
        if (!iso) continue;
        const weeksAgo = Math.floor((ref - new Date(iso).getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (weeksAgo >= 3) comingBack.push({ title: t.task.title, weeksAgo });
      }
    }
    comingBack.sort((a, b) => b.weeksAgo - a.weeksAgo);
  }
  const topComingBack = comingBack.slice(0, 4);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Post-checkout upgrade banner */}
      {upgraded === 'true' && (
        <UpgradedBanner initialIsPaid={isPaid} />
      )}

      {/* Greeting + streak */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          {todayName}
        </h1>
        {streakCount >= 2 && (
          <div className="flex items-center gap-1.5 text-sm text-primary font-medium">
            <Flame className="w-4 h-4" />
            {streakCount} weeks in a row
          </div>
        )}
      </div>

      {/* Progress layer (LTV task 2) — only once the user has checked something off */}
      {(lifetimeTasks > 0 || weekTotal > 0) && (
        <div className="rounded-xl border bg-card shadow-sm p-6">
          <div className="flex items-center gap-6">
            <ProgressRing
              percent={weekPct}
              label={`${weekPct}%`}
              sublabel="this week"
            />
            <div className="grid grid-cols-3 gap-4 flex-1 text-center">
              <div>
                <p className="text-2xl font-bold">{lifetimeTasks}</p>
                <p className="text-xs text-muted-foreground">tasks done</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatHours(lifetimeMinutes)}</p>
                <p className="text-xs text-muted-foreground">invested</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.max(streakCount, longestStreak)}</p>
                <p className="text-xs text-muted-foreground">
                  {streakCount >= longestStreak && streakCount > 0 ? 'week streak' : 'best streak'}
                </p>
              </div>
            </div>
          </div>
          {milestone && (
            <p className="mt-4 text-center text-sm font-medium text-primary">{milestone}</p>
          )}
        </div>
      )}

      {!currentPlan ? (
        /* No plan for this week */
        <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 p-10 text-center space-y-4">
          <p className="text-muted-foreground">No plan for this week yet.</p>
          <Link
            href="/quiz"
            className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Generate your week
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <>
          {/* Today's card */}
          <div className="rounded-xl border bg-card shadow-sm p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Today's focus
                </p>
                <p className="text-xl font-bold">
                  {primaryZone ? ZONE_LABEL[primaryZone] : 'Rest day'}
                </p>
                {seasonLabel && (
                  <p className="text-xs text-muted-foreground">{seasonLabel}</p>
                )}
              </div>
              {todayPlan && todayPlan.totalMinutes > 0 && (
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Scheduled</p>
                  <p className="text-lg font-semibold">{todayPlan.totalMinutes}m</p>
                  {timeRemaining > 0 && (
                    <p className="text-xs text-muted-foreground">{timeRemaining}m free</p>
                  )}
                </div>
              )}
            </div>

            {/* Today's tasks */}
            {!todayPlan || todayPlan.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Rest day — nothing scheduled.</p>
            ) : isPaid && members.length > 0 ? (
              // Member-grouped view for paid users
              (() => {
                const grouped = new Map<string, typeof todayPlan.tasks>();
                grouped.set('Unassigned', []);
                for (const m of members) grouped.set(m, []);
                for (const t of todayPlan.tasks) {
                  const member = assignments[t.task.id];
                  (grouped.get(member ?? 'Unassigned') ?? grouped.get('Unassigned')!).push(t);
                }
                return (
                  <div className="space-y-3">
                    {[...grouped.entries()].filter(([, tasks]) => tasks.length > 0).map(([member, tasks]) => (
                      <div key={member}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{member}</p>
                        <ul className="space-y-1.5">
                          {tasks.map((t) => (
                            <li key={t.task.id} className="flex items-center justify-between text-sm">
                              <span>{t.task.title}</span>
                              <span className="text-muted-foreground shrink-0 ml-4">{t.estimatedMinutes}m</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                );
              })()
            ) : (
              <ul className="space-y-2">
                {todayPlan.tasks.map((t) => (
                  <li key={t.task.id} className="flex items-center justify-between text-sm">
                    <span>{t.task.title}</span>
                    <span className="text-muted-foreground shrink-0 ml-4">
                      {t.estimatedMinutes}m
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/plan/${currentPlan.id}`}
              className="flex items-center gap-2 text-sm border rounded-lg px-4 py-2 hover:bg-muted transition-colors"
            >
              View full plan
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={`/print/${currentPlan.id}`}
              className="flex items-center gap-2 text-sm border rounded-lg px-4 py-2 hover:bg-muted transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </Link>
            <Link
              href="/quiz"
              className="flex items-center gap-2 text-sm border rounded-lg px-4 py-2 hover:bg-muted transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate plan
            </Link>
            <CompleteWeekButton planId={currentPlan.id} />
          </div>

          {/* Coming back this week — rotation memory made visible (LTV task 4) */}
          {topComingBack.length > 0 && (
            <div className="rounded-xl border bg-card shadow-sm p-6 space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">Coming back around this week</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Tasks your rotation hasn't surfaced in a while — back on the schedule now.
              </p>
              <ul className="space-y-2">
                {topComingBack.map((t) => (
                  <li key={t.title} className="flex items-center justify-between text-sm">
                    <span>{t.title}</span>
                    <span className="text-muted-foreground shrink-0 ml-4">
                      last done {t.weeksAgo} weeks ago
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Upgrade prompt — free users only */}
      {!isPaid && (
        <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 border px-5 py-3">
          <p className="text-sm text-muted-foreground">
            Unlock rotation memory and member assignment
          </p>
          <Link
            href="/pricing"
            className="shrink-0 text-sm font-semibold text-primary hover:underline"
          >
            Upgrade for $7/mo →
          </Link>
        </div>
      )}
    </main>
  );
}
