import 'server-only';
import { createAdminClient } from '@/lib/supabase/server.js';

/**
 * Attach a guest's plan to the account that just signed in.
 *
 * Runs after either sign-in path (emailed link or typed code). Makes sure the
 * public.users row exists, claims the plan if nobody owns it yet, and seeds
 * the household from that plan so the dashboard and weekly email can find it.
 * Returns true when this call claimed the plan.
 */
export async function claimPendingPlan(email: string, planId: string | undefined): Promise<boolean> {
  const admin = createAdminClient();

  let { data: userRow } = await admin.from('users').select('id').eq('email', email).maybeSingle();
  if (!userRow) {
    const { data: created } = await admin.from('users').insert({ email }).select('id').single();
    userRow = created;
  }
  if (!userRow?.id || !planId) return false;

  // Only an unowned plan can be claimed; someone else's plan is left alone.
  const { data: claimed } = await admin
    .from('plans')
    .update({ user_id: userRow.id, is_claimed: true })
    .eq('id', planId)
    .is('user_id', null)
    .select('home_size, home_type, household_count, pets, pet_types, kids, flooring_types, time_preference, profile, priorities');

  const planRow = claimed?.[0];
  if (!planRow) return false;

  await admin.from('households').upsert(
    {
      user_id: userRow.id,
      home_size: planRow.home_size,
      home_type: planRow.home_type ?? null,
      household_count: planRow.household_count,
      pets: planRow.pets,
      pet_types: planRow.pet_types ?? [],
      kids: planRow.kids,
      flooring_types: planRow.flooring_types ?? [],
      time_preference: planRow.time_preference,
      ...(planRow.profile ? { profile: planRow.profile } : {}),
      priorities: planRow.priorities ?? [],
    },
    { onConflict: 'user_id' },
  );
  return true;
}
