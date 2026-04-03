import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock, CalendarDays, ArrowRight } from 'lucide-react';
import { getServerUser } from '@/lib/supabase/session.js';
import { createAdminClient } from '@/lib/supabase/server.js';
import type { SerializedWeekPlan } from '@/utils/serialize';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatWeekRange(weekOf: string): string {
  const start = new Date(weekOf);
  const end = new Date(weekOf);
  end.setUTCDate(start.getUTCDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

function getTopZones(weekPlan: SerializedWeekPlan): string[] {
  const counts = new Map<string, number>();
  for (const day of weekPlan.days) {
    for (const t of day.tasks) {
      if (t.task.frequency !== 'daily') {
        counts.set(t.zone, (counts.get(t.zone) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([zone]) => zone.charAt(0).toUpperCase() + zone.slice(1));
}

const ZONE_COLORS: Record<string, string> = {
  kitchen:  'bg-orange-100 text-orange-700',
  bathroom: 'bg-blue-100 text-blue-700',
  bedroom:  'bg-purple-100 text-purple-700',
  living:   'bg-green-100 text-green-700',
  outdoor:  'bg-lime-100 text-lime-700',
  laundry:  'bg-sky-100 text-sky-700',
  general:  'bg-slate-100 text-slate-700',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HistoryPage() {
  const authUser = await getServerUser();
  if (!authUser?.email) notFound();

  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from('users')
    .select('id, tier')
    .eq('email', authUser.email)
    .single();

  if (!user) notFound();

  const isPaid = (user as { tier?: string }).tier === 'paid';

  // Fetch completed plans — history = weeks marked as done, regardless of date
  const { data: pastPlans } = await supabase
    .from('plans')
    .select('id, week_of, week_plan')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(isPaid ? 52 : 5);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Plan history</h1>
        <p className="text-sm text-muted-foreground">
          A record of every week you've planned.
        </p>
      </div>

      {!isPaid && (
        /* Locked state overlay */
        <div className="relative">
          {/* Preview rows (blurred) */}
          <div className="space-y-3 blur-sm select-none pointer-events-none" aria-hidden>
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-48 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-8 w-24 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Lock overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/70 rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold">Plan history is a Pro feature</p>
              <p className="text-sm text-muted-foreground">
                Keep a full record of every week you've planned.
              </p>
            </div>
            <Link
              href="/pricing"
              className="bg-primary text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity"
            >
              Upgrade to Pro →
            </Link>
          </div>
        </div>
      )}

      {isPaid && (pastPlans ?? []).length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 p-10 text-center space-y-2">
          <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground text-sm">
            No past plans yet. Complete a week to start building your history.
          </p>
        </div>
      )}

      {isPaid && (pastPlans ?? []).length > 0 && (
        <div className="space-y-3">
          {(pastPlans ?? []).map((plan) => {
            const weekPlan = plan.week_plan as SerializedWeekPlan;
            const zones = getTopZones(weekPlan);
            const weekRange = formatWeekRange(plan.week_of as string);

            return (
              <div
                key={plan.id as string}
                className="rounded-xl border bg-card p-4 flex items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <p className="text-sm font-medium">{weekRange}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {zones.map((zone) => (
                      <span
                        key={zone}
                        className={`text-xs px-2 py-0.5 rounded-full ${ZONE_COLORS[zone.toLowerCase()] ?? ZONE_COLORS.general}`}
                      >
                        {zone}
                      </span>
                    ))}
                  </div>
                </div>
                <Link
                  href={`/plan/${plan.id as string}`}
                  className="shrink-0 flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  View
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
