import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStripe } from '@/lib/stripe/client.js';
import { createAdminClient } from '@/lib/supabase/server.js';
import { getServerUser } from '@/lib/supabase/session.js';

const schema = z.object({
  priceId: z.string().min(1, 'priceId is required'),
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

  const { priceId } = parsed.data;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tideeup.com';

  // Checkout requires a signed-in account. A guest payment has no user row
  // for the webhook to upgrade, so the card would be charged for nothing.
  const authUser = await getServerUser();
  if (!authUser?.email) {
    return NextResponse.json(
      { message: 'Sign in to upgrade.', code: 'signin_required' },
      { status: 401 },
    );
  }

  try {
    const stripe = getStripe();
    const supabase = createAdminClient();

    // Someone who signed in without ever taking the quiz has no public.users
    // row yet. Create it now so the webhook always has a user to upgrade.
    let { data: user } = await supabase
      .from('users')
      .select('id, stripe_customer_id, tier, subscription_status')
      .eq('email', authUser.email)
      .maybeSingle();

    if (!user) {
      const { data: created, error: createError } = await supabase
        .from('users')
        .insert({ email: authUser.email })
        .select('id, stripe_customer_id, tier, subscription_status')
        .single();
      if (createError || !created) throw new Error(createError?.message ?? 'Could not create user');
      user = created;
    }

    // Guard: already an active subscriber — send to billing portal instead
    if (user.tier === 'paid' && user.subscription_status === 'active' && user.stripe_customer_id) {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripe_customer_id,
        return_url: `${appUrl}/pricing`,
      });
      return NextResponse.json({ url: portalSession.url }, { status: 200 });
    }

    // Always check out as a saved Stripe customer so the webhook can match it.
    let stripeCustomerId: string | null = user.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({ email: authUser.email });
      stripeCustomerId = customer.id;
      await supabase.from('users').update({ stripe_customer_id: customer.id }).eq('id', user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer: stripeCustomerId,
      // Second way for the webhook to find the account, besides the customer id.
      client_reference_id: user.id,
      success_url: `${appUrl}/pricing?success=true`,
      cancel_url: `${appUrl}/pricing`,
      // Allow promotion codes so you can run discounts without code changes
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL');
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error('[checkout] FATAL error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { message: 'Failed to create checkout session. Please try again.' },
      { status: 500 },
    );
  }
}
