import { NextResponse } from 'next/server';
import { z } from 'zod';
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

type Params = { params: Promise<{ planId: string }> };

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ message: 'Unauthorised' }, { status: 401 });

  const { planId } = await params;
  const supabase = createAdminClient();

  // Verify ownership
  const { data: plan } = await supabase
    .from('plans')
    .select('id')
    .eq('id', planId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!plan) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const { data: assignments } = await supabase
    .from('task_assignments')
    .select('task_id, member_name')
    .eq('plan_id', planId);

  return NextResponse.json({ assignments: assignments ?? [] });
}

const upsertSchema = z.object({
  taskId:     z.string().min(1),
  memberName: z.string().min(1).max(50).nullable(),
});

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ message: 'Unauthorised' }, { status: 401 });

  const { planId } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
  }

  const { taskId, memberName } = parsed.data;
  const supabase = createAdminClient();

  // Verify ownership
  const { data: plan } = await supabase
    .from('plans')
    .select('id')
    .eq('id', planId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!plan) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  if (memberName === null) {
    // Remove assignment
    await supabase
      .from('task_assignments')
      .delete()
      .eq('plan_id', planId)
      .eq('task_id', taskId);
  } else {
    await supabase
      .from('task_assignments')
      .upsert({ plan_id: planId, task_id: taskId, member_name: memberName }, { onConflict: 'plan_id,task_id' });
  }

  return NextResponse.json({ ok: true });
}
