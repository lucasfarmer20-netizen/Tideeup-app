import 'server-only';
import type { createAdminClient } from '@/lib/supabase/server.js';
import { advanceRotation } from '@/lib/engine/rotator.js';
import type { RotationState } from '@/lib/engine/types.js';
import type { StreakData } from '@/types/api';
import type { SerializedWeekPlan } from '@/utils/serialize';
import type { Json } from '@/lib/supabase/types.js';

type AdminClient = ReturnType<typeof createAdminClient>;

export interface FinalizablePlan {
  id: string;
  week_plan: SerializedWeekPlan;
  week_of: string;
  completed_at: string | null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Marks a week plan complete: stamps `completed_at`, advances the household's
 * rotation state, and bumps the user's streak. Idempotent — if the plan already
 * has a `completed_at`, it returns the current streak without re-applying.
 *
 * Used by both POST /api/plan/complete (manual "mark week done") and
 * POST /api/plan/[planId]/completions (auto-complete when every task is checked).
 */
export async function finalizeWeek(
  supabase: AdminClient,
  userId: string,
  plan: FinalizablePlan,
): Promise<StreakData> {
  // Idempotency: never double-apply rotation/streak.
  if (plan.completed_at) {
    const { data: existing } = await supabase
      .from('streaks')
      .select('current_streak, longest_streak, last_completed_week')
      .eq('user_id', userId)
      .maybeSingle();
    return {
      currentStreak: (existing as { current_streak?: number } | null)?.current_streak ?? 0,
      longestStreak: (existing as { longest_streak?: number } | null)?.longest_streak ?? 0,
      lastCompletedWeek:
        (existing as { last_completed_week?: string | null } | null)?.last_completed_week ?? null,
    };
  }

  // Stamp completed_at on the plan record.
  await supabase
    .from('plans')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', plan.id);

  const weekPlan = plan.week_plan;
  const weekOf = new Date(plan.week_of);

  // Collect all task IDs from the plan.
  const doneIds = weekPlan.days.flatMap((d) => d.tasks.map((t) => t.task.id));

  // Advance rotation state (paid feature — ignored if no household or null state).
  const { data: household } = await supabase
    .from('households')
    .select('rotation_state, completed_weeks')
    .eq('user_id', userId)
    .maybeSingle();

  if (household) {
    const existing: RotationState =
      ((household as { rotation_state?: RotationState }).rotation_state as RotationState) ?? {
        lastDone: {},
        memberAssignments: {},
      };
    const updated = advanceRotation(existing, doneIds, weekOf);

    await supabase
      .from('households')
      .update({
        rotation_state: updated as unknown as Json,
        completed_weeks: ((household as { completed_weeks?: number }).completed_weeks ?? 0) + 1,
      })
      .eq('user_id', userId);
  }

  // Update streak.
  const { data: existingStreak } = await supabase
    .from('streaks')
    .select('current_streak, longest_streak, last_completed_week')
    .eq('user_id', userId)
    .maybeSingle();

  const lastWeek = (existingStreak as { last_completed_week?: string | null } | null)
    ?.last_completed_week
    ? new Date((existingStreak as { last_completed_week: string }).last_completed_week)
    : null;

  const daysSinceLast = lastWeek ? daysBetween(lastWeek, weekOf) : Infinity;
  // Increment streak if last completion was within 8 days; otherwise reset to 1.
  const newCurrentStreak =
    daysSinceLast <= 8
      ? ((existingStreak as { current_streak?: number } | null)?.current_streak ?? 0) + 1
      : 1;
  const newLongestStreak = Math.max(
    newCurrentStreak,
    (existingStreak as { longest_streak?: number } | null)?.longest_streak ?? 0,
  );
  const lastCompletedWeek = weekOf.toISOString().slice(0, 10);

  await supabase.from('streaks').upsert(
    {
      user_id: userId,
      current_streak: newCurrentStreak,
      longest_streak: newLongestStreak,
      last_completed_week: lastCompletedWeek,
    },
    { onConflict: 'user_id' },
  );

  return {
    currentStreak: newCurrentStreak,
    longestStreak: newLongestStreak,
    lastCompletedWeek,
  };
}
