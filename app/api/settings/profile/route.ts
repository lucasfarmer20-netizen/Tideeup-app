import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/server.js';

export async function GET(): Promise<NextResponse> {
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

  const supabase = createAdminClient();
  const { data: userRow } = await supabase
    .from('users')
    .select('id, tier')
    .eq('email', authUser.email)
    .maybeSingle();

  const userId = (userRow as { id?: string } | null)?.id ?? null;
  const isPaid = (userRow as { tier?: string } | null)?.tier === 'paid';

  if (!userId) {
    return NextResponse.json({ household: null, customTasks: [], isPaid: false });
  }

  const [hRes, ctRes] = await Promise.all([
    supabase
      .from('households')
      .select('home_size, household_count, pets, kids, time_preference, members, no_go_days, season_override')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('custom_tasks').select('id, title, zone, frequency, estimated_minutes').eq('user_id', userId),
  ]);

  return NextResponse.json({
    household: hRes.data ?? null,
    customTasks: ctRes.data ?? [],
    isPaid,
  });
}
