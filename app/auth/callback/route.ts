import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { claimPendingPlan } from '@/lib/auth/claim-pending-plan';

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
  const rawNext = requestUrl.searchParams.get('next') ?? '/';
  // Only allow relative paths — reject absolute URLs and protocol-relative URLs
  const next = (rawNext.startsWith('/') && !rawNext.startsWith('//')) ? rawNext : '/';

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
        if (authUser?.email) await claimPendingPlan(authUser.email, pendingPlanId);
      } catch (claimErr) {
        console.error('[auth/callback] plan claim error:', claimErr);
        // Non-fatal — user still lands on dashboard, plan may appear on refresh.
      }

      // Clear the cookie regardless of claim outcome.
      cookieStore.delete('pending_plan_id');

      // Land on the dashboard so the claimed plan is visible, unless the person
      // was on their way somewhere specific (for example, back to checkout).
      return NextResponse.redirect(new URL(next === '/' ? '/dashboard' : next, requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
