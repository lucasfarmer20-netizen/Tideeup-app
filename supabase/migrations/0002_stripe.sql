-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  TideeUp — Stripe billing fields                                            │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- ── Stripe billing columns on users ───────────────────────────────────────────
alter table users
  add column stripe_customer_id     text unique,
  add column stripe_subscription_id text,
  add column subscription_status    text
    check (subscription_status in (
      'active', 'canceled', 'past_due', 'trialing',
      'incomplete', 'incomplete_expired', 'unpaid'
    )),
  add column current_period_end     timestamptz;

-- ── tier: replaces the plain is_paid boolean ──────────────────────────────────
-- Drop the old boolean column and replace with a proper tier enum.
-- Generated column is_paid is preserved for backward compat with existing code.
alter table users drop column is_paid;

alter table users
  add column tier     text not null default 'free'
    check (tier in ('free', 'paid')),
  add column is_paid  boolean generated always as (tier = 'paid') stored;

-- Index for webhook lookups by Stripe customer ID
create index users_stripe_customer_id_idx on users(stripe_customer_id);
