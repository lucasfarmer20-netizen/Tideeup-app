import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStripe } from '@/lib/stripe/client.js';
import { createAdminClient } from '@/lib/supabase/server.js';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }

  const { email } = parsed.data;
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
        { message: 'No active subscription found for that email address.' },
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
