/**
 * Stripe plan / price configuration.
 *
 * Price IDs come from environment variables so you can swap test ↔ live keys
 * without touching code. Set them in .env.local (see .env.example).
 *
 * To set up in Stripe Dashboard (test mode):
 *   1. Products → Add product → "TideeUp Pro"
 *   2. Add two prices:
 *        • $7.00 / month  (recurring)
 *        • $60.00 / year  (recurring)
 *   3. Copy the price IDs (price_xxx) into .env.local
 *
 * For local webhook testing, run:
 *   stripe listen --forward-to localhost:3000/api/stripe/webhook
 *   (requires Stripe CLI: https://stripe.com/docs/stripe-cli)
 */

export type BillingInterval = 'month' | 'year';

export const FREE_FEATURES = [
  'Personalised 7-day cleaning plan',
  'Zone-anchored scheduling',
  'Seasonal task weighting',
  'Chaos adjustment (pets & kids)',
  'One-time plan generation — no account needed',
] as const;

export const PRO_FEATURES = [
  'Everything in Free',
  'Rotation memory — no repeated tasks week to week',
  'Member assignment — who does what',
  'Plan history — view past weeks',
  'Custom tasks — add your own to the library',
  'Season mode — override the detected season',
  'Sunday email digest — plan arrives before the week starts',
] as const;

export const PRICES = {
  monthly: {
    id: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID ?? '',
    amountCents: 700,
    interval: 'month' as BillingInterval,
    label: '$7 / month',
  },
  annual: {
    id: process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID ?? '',
    amountCents: 6000,
    interval: 'year' as BillingInterval,
    label: '$60 / year',
    monthlyEquivalent: '$5 / month',
    savingsLabel: 'Save $24 / year',
  },
} as const;
