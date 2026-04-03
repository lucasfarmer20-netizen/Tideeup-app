import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/server.js';

async function getAuthUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ message: 'Unauthorised' }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('custom_tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', userId); // ownership check

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
