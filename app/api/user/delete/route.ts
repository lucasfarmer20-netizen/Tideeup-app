import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server.js';
import { getServerUser } from '@/lib/supabase/session.js';
import { getStripe } from '@/lib/stripe/client.js';

export async function DELETE(): Promise<NextResponse> {
  const authUser = await getServerUser();
  if (!authUser?.email) {
    return NextResponse.json({ message: 'Unauthorised' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: userRow } = await supabase
    .from('users')
    .select('id, stripe_customer_id')
    .eq('email', authUser.email)
    .maybeSingle();

  if (!userRow) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 });
  }

  // Cancel Stripe subscription if one exists
  const customerId = (userRow as { stripe_customer_id?: string }).stripe_customer_id;
  if (customerId) {
    try {
      const subscriptions = await getStripe().subscriptions.list({
        customer: customerId,
        status: 'active',
      });
      for (const sub of subscriptions.data) {
        await getStripe().subscriptions.cancel(sub.id);
      }
    } catch (err) {
      console.warn('[user/delete] Stripe cancellation failed:', err);
      // Continue with deletion — Stripe webhook will handle any cleanup
    }
  }

  // Delete user data (order matters for FK constraints without cascades)
  const uid = (userRow as { id: string }).id;
  await supabase.from('task_assignments').delete().eq('plan_id', uid); // task_assignments FK is plan_id, clean via plans
  await supabase.from('streaks').delete().eq('user_id', uid);
  await supabase.from('custom_tasks').delete().eq('user_id', uid);
  await supabase.from('plans').delete().eq('user_id', uid);
  await supabase.from('households').delete().eq('user_id', uid);
  await supabase.from('email_events').delete().eq('user_id', uid);
  await supabase.from('users').delete().eq('id', uid);

  // Delete the Supabase auth user
  await supabase.auth.admin.deleteUser(authUser.id);

  return NextResponse.json({ ok: true });
}
