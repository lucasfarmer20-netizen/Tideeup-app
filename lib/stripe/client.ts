import 'server-only';
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/**
 * Stripe server-side singleton.
 * The `server-only` import above will throw a build error if this is ever
 * imported in a Client Component.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('Missing STRIPE_SECRET_KEY env var');
    _stripe = new Stripe(key, { apiVersion: '2026-03-25.dahlia' });
  }
  return _stripe;
}
