import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/supabase/session.js';
import { AppNav } from '@/components/nav/AppNav';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();
  if (!user) redirect('/quiz');

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      {children}
    </div>
  );
}
