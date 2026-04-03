import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/server.js';

const schema = z.object({
  title:             z.string().min(1).max(100),
  zone:              z.enum(['kitchen', 'bathroom', 'bedroom', 'living', 'outdoor', 'laundry', 'general']),
  frequency:         z.enum(['daily', 'weekly', 'monthly']),
  estimatedMinutes:  z.number().int().min(1).max(480),
});

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

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ message: 'Unauthorised' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid input', errors: parsed.error.flatten() }, { status: 400 });
  }

  const { title, zone, frequency, estimatedMinutes } = parsed.data;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('custom_tasks')
    .insert({ user_id: userId, title, zone, frequency, estimated_minutes: estimatedMinutes })
    .select('id, title, zone, frequency, estimated_minutes')
    .single();

  if (error || !data) {
    return NextResponse.json({ message: error?.message ?? 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json({ task: data }, { status: 201 });
}
