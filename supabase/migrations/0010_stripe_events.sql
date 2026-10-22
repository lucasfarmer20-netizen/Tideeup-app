-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  TideeUp — Stripe webhook idempotency                                        │
-- └─────────────────────────────────────────────────────────────────────────────┘
--
-- Stripe retries webhook deliveries and may deliver the same event more than
-- once. The webhook handler inserts the event id here before processing; a
-- conflict means "already handled — skip". Keyed on Stripe's own event id.
--
-- Service-role only: RLS is enabled with no policies, so the anon/auth roles
-- can neither read nor write it. The webhook uses the admin client.

CREATE TABLE IF NOT EXISTS stripe_events (
  id           text PRIMARY KEY,          -- Stripe event id, e.g. evt_1Nxxxxx
  type         text NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS stripe_events_received_at_idx
  ON stripe_events (received_at);
