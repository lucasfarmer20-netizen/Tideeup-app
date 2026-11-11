import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getServerUser } from '@/lib/supabase/session.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Return to your plan', robots: { index: false, follow: false } };

const PLAN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "Return to my plan" from the homepage. A guest's plan id lives in an
 * HttpOnly cookie for 7 days, so the lookup has to happen on the server.
 */
export default async function ResumePlanPage() {
  const authUser = await getServerUser().catch(() => null);
  if (authUser) redirect('/dashboard');

  const planId = (await cookies()).get('pending_plan_id')?.value;
  if (planId && PLAN_ID.test(planId)) redirect(`/plan/${planId}`);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">No saved plan in this browser</h1>
        <p className="text-muted-foreground">
          Guest plans are remembered for 7 days in the browser where you made them. If you had
          the link emailed, open it from your inbox. If you have an account, sign in.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link href="/quiz">Build a free plan</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/auth/signin">Sign in</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
