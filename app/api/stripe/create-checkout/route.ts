import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStripe } from '@/lib/stripe/client.js';
import { createAdminClient } from '@/lib/supabase/server.js';
import { getServerUser } from '@/lib/supabase/session.js';

const schema = z.object({
  priceId: z.string().min(1, 'priceId is required'),
  email: z.string().email().optional(),
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

  // Trust the authenticated session email; fall back to body email only
  // for unauthenticated visitors on the public pricing page.
  const authUser = await getServerUser();
  const trustedEmail = authUser?.email ?? parsed.data.email ?? null;

  try {
    const stripe = getStripe();
    const supabase = createAdminClient();

    let stripeCustomerId: string | null = null;

    // Only look up existing user data when we have a trusted (auth-verified) email.
    // Unauthenticated callers cannot trigger lookups for arbitrary emails.
    if (authUser?.email) {
      const { data: user } = await supabase
        .from('users')
        .select('id, stripe_customer_id, tier, subscription_status')
        .eq('email', authUser.email)
        .maybeSingle();

      // Guard: already an active subscriber — send to billing portal instead
      if (
        user?.tier === 'paid' &&
        user.subscription_status === 'active' &&
        user.stripe_customer_id
      ) {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: user.stripe_customer_id,
          return_url: `${appUrl}/pricing`,
        });
        return NextResponse.json({ url: portalSession.url }, { status: 200 });
      }

      if (user?.stripe_customer_id) {
        stripeCustomerId = user.stripe_customer_id;
      } else if (user && !user.stripe_customer_id) {
        // Create a Stripe customer and save it now so the webhook can match later
        const customer = await stripe.customers.create({ email: authUser.email });
        stripeCustomerId = customer.id;

        await supabase
          .from('users')
          .update({ stripe_customer_id: customer.id })
          .eq('id', user.id);
      }
    }

    // Build customer identification — exactly one of customer or customer_email
    const customerParam = stripeCustomerId
      ? ({ customer: stripeCustomerId } as const)
      : trustedEmail
        ? ({ customer_email: trustedEmail } as const)
        : ({} as const);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      ...customerParam,
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
