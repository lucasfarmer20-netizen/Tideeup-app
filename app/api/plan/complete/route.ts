import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server.js';
import { advanceRotation } from '@/lib/engine/rotator.js';
import type { RotationState } from '@/lib/engine/types.js';
import type { CompleteWeekResponse, StreakData } from '@/types/api';
import type { SerializedWeekPlan } from '@/utils/serialize';

const schema = z.object({
  planId: z.string().min(1),
});

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export async function POST(request: Request): Promise<NextResponse> {
  // Verify the caller is authenticated
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user: authUser } } = await authClient.auth.getUser();
  if (!authUser?.email) {
    return NextResponse.json({ message: 'Unauthorised' }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'planId is required' }, { status: 400 });
  }

  const { planId } = parsed.data;
  const supabase = createAdminClient();

  try {
    // Look up the user row
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', authUser.email)
      .single();

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Verify plan belongs to this user and get the week_plan + week_of
    const { data: plan } = await supabase
      .from('plans')
      .select('id, week_plan, week_of, user_id, completed_at')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single();

    if (!plan) {
      return NextResponse.json({ message: 'Plan not found' }, { status: 404 });
    }

    // Idempotency: prevent double-completion and streak farming
    if (plan.completed_at) {
      return NextResponse.json(
        { message: 'This plan has already been marked as completed.' },
        { status: 400 },
      );
    }

    // Stamp completed_at on the plan record
    await supabase
      .from('plans')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', planId);

    const weekPlan = plan.week_plan as SerializedWeekPlan;
    const weekOf = new Date(plan.week_of as string);

    // Collect all task IDs from the plan
    const doneIds = weekPlan.days
      .flatMap((d) => d.tasks.map((t) => t.task.id));

    // Advance rotation state (paid feature — ignored if no household or null state)
    const { data: household } = await supabase
      .from('households')
      .select('rotation_state, completed_weeks')
      .eq('user_id', user.id)
      .maybeSingle();

    if (household) {
      const existing: RotationState = (household.rotation_state as RotationState) ?? {
        lastDone: {},
        memberAssignments: {},
      };
      const updated = advanceRotation(existing, doneIds, weekOf);

      await supabase
        .from('households')
        .update({
          rotation_state: updated as unknown as import('@/lib/supabase/types.js').Json,
          completed_weeks: (household.completed_weeks ?? 0) + 1,
        })
        .eq('user_id', user.id);
    }

    // Update streak
    const { data: existingStreak } = await supabase
      .from('streaks')
      .select('current_streak, longest_streak, last_completed_week')
      .eq('user_id', user.id)
      .maybeSingle();

    const lastWeek = existingStreak?.last_completed_week
      ? new Date(existingStreak.last_completed_week)
      : null;

    const daysSinceLast = lastWeek ? daysBetween(lastWeek, weekOf) : Infinity;
    // Increment streak if last completion was within 8 days; otherwise reset to 1
    const newCurrentStreak =
      daysSinceLast <= 8 ? (existingStreak?.current_streak ?? 0) + 1 : 1;
    const newLongestStreak = Math.max(
      newCurrentStreak,
      existingStreak?.longest_streak ?? 0,
    );
    const lastCompletedWeek = weekOf.toISOString().slice(0, 10);

    await supabase.from('streaks').upsert(
      {
        user_id: user.id,
        current_streak: newCurrentStreak,
        longest_streak: newLongestStreak,
        last_completed_week: lastCompletedWeek,
      },
      { onConflict: 'user_id' },
    );

    const streak: StreakData = {
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastCompletedWeek: lastCompletedWeek,
    };

    const response: CompleteWeekResponse = { streak };
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[plan/complete] error:', err);
    return NextResponse.json(
      { message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
