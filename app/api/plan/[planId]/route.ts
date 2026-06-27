import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server.js';
import { getServerUser } from '@/lib/supabase/session.js';
import type { GetPlanResponse } from '@/types/api';
import type { SerializedWeekPlan } from '@/utils/serialize';

interface RouteParams {
  params: Promise<{ planId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { planId } = await params;

  try {
    const supabase = createAdminClient();
    const authUser = await getServerUser();

    if (authUser?.email) {
      // Authenticated: verify ownership
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .maybeSingle();

      if (!userRow) {
        return NextResponse.json({ message: 'Plan not found' }, { status: 404 });
      }

      const { data, error } = await supabase
        .from('plans')
        .select('id, week_plan, is_claimed')
        .eq('id', planId)
        .eq('user_id', userRow.id)
        .single();

      if (error || !data) {
        return NextResponse.json({ message: 'Plan not found' }, { status: 404 });
      }

      const row = data as { id: string; week_plan: SerializedWeekPlan; is_claimed: boolean };
      const response: GetPlanResponse = {
        planId: row.id,
        weekPlan: row.week_plan,
        isClaimed: row.is_claimed,
      };
      return NextResponse.json(response);
    }

    // Unauthenticated: only allow access to the plan matching the pending_plan_id cookie
    const cookieStore = await cookies();
    const pendingPlanId = cookieStore.get('pending_plan_id')?.value;

    if (!pendingPlanId || pendingPlanId !== planId) {
      return NextResponse.json({ message: 'Unauthorised' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('plans')
      .select('id, week_plan, is_claimed')
      .eq('id', planId)
      .single();

    if (error || !data) {
      return NextResponse.json({ message: 'Plan not found' }, { status: 404 });
    }

    const row = data as { id: string; week_plan: SerializedWeekPlan; is_claimed: boolean };
    const response: GetPlanResponse = {
      planId: row.id,
      weekPlan: row.week_plan,
      isClaimed: row.is_claimed,
    };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ message: 'Failed to fetch plan' }, { status: 500 });
  }
}
