import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server.js';

/**
 * Handles the Supabase magic link callback.
 *
 * Supabase redirects here after verifying the OTP with:
 *   ?code=<auth_code>&next=/plan/<planId>
 *
 * We exchange the code for a session (sets cookies), then redirect
 * to the `next` destination so the user lands on their plan page
 * already authenticated.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[auth/callback] exchangeCodeForSession error:', error.message);
      return NextResponse.redirect(new URL('/?auth_error=1', requestUrl.origin));
    }

    // Bug 2 fix: claim any anonymous plan generated before the user signed in.
    const pendingPlanId = cookieStore.get('pending_plan_id')?.value;
    if (pendingPlanId) {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser?.email) {
          const adminClient = createAdminClient();

          // Resolve the public.users row for this email (created by capture or on signup).
          const { data: userRow } = await adminClient
            .from('users')
            .select('id')
            .eq('email', authUser.email)
            .maybeSingle();

          if (userRow?.id) {
            // Claim the plan (no-op if already claimed — .is('user_id', null) guard).
            await adminClient
              .from('plans')
              .update({ user_id: userRow.id, is_claimed: true })
              .eq('id', pendingPlanId)
              .is('user_id', null);

            // Ensure a household config row exists so the dashboard + cron can find it.
            const { data: planRow } = await adminClient
              .from('plans')
              .select('home_size, household_count, pets, kids, time_preference')
              .eq('id', pendingPlanId)
              .maybeSingle();

            if (planRow) {
              await adminClient.from('households').upsert(
                {
                  user_id: userRow.id,
                  home_size: planRow.home_size,
                  household_count: planRow.household_count,
                  pets: planRow.pets,
                  kids: planRow.kids,
                  time_preference: planRow.time_preference,
                },
                { onConflict: 'user_id' },
              );
            }
          }
        }
      } catch (claimErr) {
        console.error('[auth/callback] plan claim error:', claimErr);
        // Non-fatal — user still lands on dashboard, plan may appear on refresh.
      }

      // Clear the cookie regardless of claim outcome.
      cookieStore.delete('pending_plan_id');

      // Send to dashboard so the claimed plan is immediately visible.
      return NextResponse.redirect(new URL('/dashboard', requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
