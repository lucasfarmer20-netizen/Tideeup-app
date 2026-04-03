import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { WeekPlanView } from '@/components/plan/WeekPlanView';
import { createAdminClient } from '@/lib/supabase/server.js';
import { getServerUser } from '@/lib/supabase/session.js';
import type { SerializedWeekPlan } from '@/utils/serialize';

interface PageProps {
  params: Promise<{ planId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { planId } = await params;
  return {
    title: `Your cleaning plan — ${planId.slice(0, 8)}`,
    description: 'Your personalized weekly cleaning schedule from TideeUp.',
  };
}

export default async function PlanPage({ params }: PageProps) {
  const { planId } = await params;

  let plan: SerializedWeekPlan | null = null;
  let members: string[] = [];
  let isPaid = false;

  try {
    const supabase = createAdminClient();
    const [planRes, authUser] = await Promise.all([
      supabase.from('plans').select('id, week_plan, is_claimed, created_at').eq('id', planId).single(),
      getServerUser(),
    ]);

    const { data, error } = planRes;
    if (error || !data) notFound();

    plan = data.week_plan as SerializedWeekPlan;
    if (!plan) notFound();

    // Load members and tier for authenticated users
    if (authUser?.email) {
      const { data: userRow } = await supabase
        .from('users')
        .select('id, tier')
        .eq('email', authUser.email)
        .maybeSingle();

      if (userRow) {
        isPaid = (userRow as { tier?: string }).tier === 'paid';
        if (isPaid) {
          const { data: household } = await supabase
            .from('households')
            .select('members')
            .eq('user_id', (userRow as { id: string }).id)
            .maybeSingle();
          members = (household as { members?: string[] } | null)?.members ?? [];
        }
      }
    }
  } catch (err) {
    // In development without Supabase configured, show a friendly message
    if (process.env.NODE_ENV === 'development') {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center space-y-4 max-w-md">
            <h1 className="text-xl font-bold">Supabase not configured</h1>
            <p className="text-muted-foreground text-sm">
              Set up your <code className="bg-muted px-1 py-0.5 rounded">.env.local</code> file
              with Supabase credentials to view saved plans.
            </p>
            <Button asChild variant="outline">
              <Link href="/quiz">Back to quiz</Link>
            </Button>
          </div>
        </div>
      );
    }
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white sticky top-0 z-10 no-print">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-primary">TideeUp</Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/quiz">New plan</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 pt-6 no-print">
        <Link
          href="/dashboard"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          ← Back to dashboard
        </Link>
      </div>

      <main className="max-w-5xl mx-auto px-4 pt-4 pb-8">
        <WeekPlanView plan={plan} planId={planId} members={members} isPaid={isPaid} />
      </main>
    </div>
  );
}
