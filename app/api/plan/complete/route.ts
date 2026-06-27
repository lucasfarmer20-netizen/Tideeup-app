import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server.js';
import { finalizeWeek } from '@/lib/plan/finalize.js';
import type { CompleteWeekResponse } from '@/types/api';
import type { SerializedWeekPlan } from '@/utils/serialize';

const schema = z.object({
  planId: z.string().min(1),
});

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

    const streak = await finalizeWeek(supabase, user.id, {
      id: plan.id as string,
      week_plan: plan.week_plan as SerializedWeekPlan,
      week_of: plan.week_of as string,
      completed_at: plan.completed_at as string | null,
    });

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
