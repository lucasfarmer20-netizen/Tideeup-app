import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/supabase/session.js';
import { AppNav } from '@/components/nav/AppNav';
import { TimezoneCookie } from '@/components/nav/TimezoneCookie';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();
  // A signed-out visit (expired session, emailed link) should ask to sign in,
  // not restart the quiz.
  if (!user) redirect('/auth/signin?next=/dashboard');

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <TimezoneCookie />
      {children}
    </div>
  );
}
