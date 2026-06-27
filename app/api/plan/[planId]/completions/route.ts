import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/server.js';
import { finalizeWeek } from '@/lib/plan/finalize.js';
import type { SerializedWeekPlan } from '@/utils/serialize';
import type { TaskCompletionsResponse, ToggleCompletionResponse } from '@/types/api';

async function getAuthUserId(): Promise<string | null> {
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
  const { data: { user } } = await authClient.auth.getUser();
  if (!user?.email) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.from('users').select('id').eq('email', user.email).maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

type Params = { params: Promise<{ planId: string }> };

/** Total number of (day, task) checkboxes across the plan. */
function totalTaskCount(weekPlan: SerializedWeekPlan): number {
  return weekPlan.days.reduce((sum, day) => sum + day.tasks.length, 0);
}

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ message: 'Unauthorised' }, { status: 401 });

  const { planId } = await params;
  const supabase = createAdminClient();

  // Verify ownership and load the plan for the total count.
  const { data: plan } = await supabase
    .from('plans')
    .select('id, week_plan')
    .eq('id', planId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!plan) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const { data: completions } = await supabase
    .from('task_completions')
    .select('task_id, day_index')
    .eq('plan_id', planId);

  const rows = (completions ?? []) as { task_id: string; day_index: number }[];
  const response: TaskCompletionsResponse = {
    completions: rows.map((r) => ({ taskId: r.task_id, dayIndex: r.day_index })),
    total: totalTaskCount((plan as { week_plan: SerializedWeekPlan }).week_plan),
  };
  return NextResponse.json(response);
}

const toggleSchema = z.object({
  taskId: z.string().min(1),
  dayIndex: z.number().int().min(0).max(6),
  done: z.boolean(),
});

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ message: 'Unauthorised' }, { status: 401 });

  const { planId } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
  }

  const { taskId, dayIndex, done } = parsed.data;
  const supabase = createAdminClient();

  // Verify ownership and load the plan (need week_plan + completion state).
  const { data: plan } = await supabase
    .from('plans')
    .select('id, week_plan, week_of, completed_at, tenant_id')
    .eq('id', planId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!plan) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const weekPlan = (plan as { week_plan: SerializedWeekPlan }).week_plan;

  // Validate the (taskId, dayIndex) actually exists in the plan.
  const scheduled = weekPlan.days[dayIndex]?.tasks.find((t) => t.task.id === taskId);
  if (!scheduled) {
    return NextResponse.json({ message: 'Task not found in plan' }, { status: 400 });
  }

  if (done) {
    await supabase.from('task_completions').upsert(
      {
        plan_id: planId,
        user_id: userId,
        tenant_id: (plan as { tenant_id?: string | null }).tenant_id ?? null,
        task_id: taskId,
        day_index: dayIndex,
        minutes: scheduled.estimatedMinutes,
      },
      { onConflict: 'plan_id,task_id,day_index' },
    );
  } else {
    await supabase
      .from('task_completions')
      .delete()
      .eq('plan_id', planId)
      .eq('task_id', taskId)
      .eq('day_index', dayIndex);
  }

  // Recompute progress.
  const { count } = await supabase
    .from('task_completions')
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', planId);

  const completed = count ?? 0;
  const total = totalTaskCount(weekPlan);

  // Auto-complete the week the moment every task is checked off.
  let autoCompleted = false;
  let streak: ToggleCompletionResponse['streak'];
  if (completed >= total && total > 0 && !(plan as { completed_at: string | null }).completed_at) {
    streak = await finalizeWeek(supabase, userId, {
      id: plan.id as string,
      week_plan: weekPlan,
      week_of: (plan as { week_of: string }).week_of,
      completed_at: (plan as { completed_at: string | null }).completed_at,
    });
    autoCompleted = true;
  }

  const response: ToggleCompletionResponse = {
    completed,
    total,
    autoCompleted,
    ...(streak ? { streak } : {}),
  };
  return NextResponse.json(response);
}
