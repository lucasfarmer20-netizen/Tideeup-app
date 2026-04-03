import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server.js';
import type { GetPlanResponse } from '@/types/api';
import type { SerializedWeekPlan } from '@/utils/serialize';

interface RouteParams {
  params: Promise<{ planId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { planId } = await params;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('plans')
      .select('id, week_plan, is_claimed')
      .eq('id', planId)
      .single();

    if (error || !data) {
      return NextResponse.json({ message: 'Plan not found' }, { status: 404 });
    }

    // Cast to the concrete row shape we selected
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
