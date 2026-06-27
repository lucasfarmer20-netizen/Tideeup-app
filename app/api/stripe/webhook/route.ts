import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/client.js';
import { createAdminClient } from '@/lib/supabase/server.js';

// Disable Next.js body parsing — Stripe needs the raw body to verify the signature.
export const config = { api: { bodyParser: false } };

export async function POST(request: Request): Promise<NextResponse> {
  const sig = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ message: 'Missing signature or secret' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await request.text();
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error('[TideeUp] Webhook signature verification failed:', err);
    return NextResponse.json({ message: 'Invalid signature' }, { status: 400 });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    // Log but return 200 — Stripe will retry on 5xx, and a permanent failure
    // should not trigger endless retries for application-level errors.
    console.error(`[TideeUp] Webhook handler error for ${event.type}:`, err);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleEvent(event: Stripe.Event): Promise<void> {
  const stripe = getStripe();
  const supabase = createAdminClient();

  switch (event.type) {
    // ── Checkout completed → grant access ──────────────────────────────────
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription') break;

      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      const email =
        session.customer_details?.email ?? session.customer_email ?? null;

      // Fetch subscription so we have current_period_end (on item in dahlia API)
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      const itemPeriodEnd = subscription.items.data[0]?.current_period_end;
      const periodEnd = itemPeriodEnd
        ? new Date(itemPeriodEnd * 1000).toISOString()
        : null;

      // Find user — prefer stripe_customer_id match, fall back to email
      let userId: string | null = null;

      const { data: byCustomer } = await supabase
        .from('users')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();

      if (byCustomer) {
        userId = byCustomer.id;
      } else if (email) {
        const { data: byEmail } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        userId = byEmail?.id ?? null;
      }

      if (!userId) {
        console.warn(
          `[TideeUp] checkout.session.completed: no user found for customer ${customerId} / email ${email}`,
        );
        break;
      }

      await supabase
        .from('users')
        .update({
          tier: 'paid',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: subscription.status,
          current_period_end: periodEnd,
        })
        .eq('id', userId);

      // Stamp paid_since once (first upgrade only) to anchor the onboarding
      // sequence — re-subscribing won't replay it. (LTV task 5)
      await supabase
        .from('users')
        .update({ paid_since: new Date().toISOString() })
        .eq('id', userId)
        .is('paid_since', null);

      break;
    }

    // ── Subscription updated → sync status + period end ────────────────────
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const subItemEnd = sub.items.data[0]?.current_period_end;
      const periodEnd = subItemEnd ? new Date(subItemEnd * 1000).toISOString() : null;

      // If the subscription becomes active again after past_due, restore paid tier
      const tier = sub.status === 'active' || sub.status === 'trialing'
        ? 'paid'
        : 'free';

      await supabase
        .from('users')
        .update({
          tier,
          subscription_status: sub.status,
          current_period_end: periodEnd,
        })
        .eq('stripe_customer_id', customerId);

      break;
    }

    // ── Subscription deleted → revoke access ───────────────────────────────
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      await supabase
        .from('users')
        .update({
          tier: 'free',
          stripe_subscription_id: null,
          subscription_status: 'canceled',
          current_period_end: null,
        })
        .eq('stripe_customer_id', customerId);

      break;
    }

    default:
      // Unhandled event types are silently ignored
      break;
  }
}
