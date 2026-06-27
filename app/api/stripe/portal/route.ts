import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/client.js';
import { createAdminClient } from '@/lib/supabase/server.js';
import { getServerUser } from '@/lib/supabase/session.js';

export async function POST(): Promise<NextResponse> {
  const authUser = await getServerUser();
  if (!authUser?.email) {
    return NextResponse.json({ message: 'Sign in to manage your subscription.' }, { status: 401 });
  }

  const email = authUser.email;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tideeup.com';

  try {
    const supabase = createAdminClient();

    const { data: user } = await supabase
      .from('users')
      .select('stripe_customer_id, tier')
      .eq('email', email)
      .maybeSingle();

    if (!user || user.tier !== 'paid') {
      return NextResponse.json(
        { message: 'No active subscription found.' },
        { status: 404 },
      );
    }

    if (!user.stripe_customer_id) {
      return NextResponse.json(
        { message: 'No billing record found. Please contact support.' },
        { status: 404 },
      );
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${appUrl}/pricing`,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error('[TideeUp] portal error:', err);
    return NextResponse.json(
      { message: 'Failed to open billing portal. Please try again.' },
      { status: 500 },
    );
  }
}
