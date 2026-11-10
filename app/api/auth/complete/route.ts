import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerUser } from '@/lib/supabase/session.js';
import { claimPendingPlan } from '@/lib/auth/claim-pending-plan';

/**
 * Called by the verify page right after a typed sign-in code is accepted.
 * The emailed-link path does the same work in /auth/callback.
 */
export async function POST(): Promise<NextResponse> {
  const authUser = await getServerUser();
  if (!authUser?.email) {
    return NextResponse.json({ message: 'Not signed in' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const pendingPlanId = cookieStore.get('pending_plan_id')?.value;

  let claimed = false;
  try {
    claimed = await claimPendingPlan(authUser.email, pendingPlanId);
  } catch (err) {
    // Non-fatal: the person is signed in; the plan can still be opened by link.
    console.error('[auth/complete] plan claim error:', err);
  }
  if (pendingPlanId) cookieStore.delete('pending_plan_id');

  return NextResponse.json({ ok: true, claimed });
}
