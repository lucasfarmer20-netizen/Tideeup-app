-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  TideeUp — LTV task 5: post-upgrade onboarding sequence                      │
-- └─────────────────────────────────────────────────────────────────────────────┘
--
-- Records when a user first became a paying subscriber. The onboarding email
-- cron paces the welcome sequence (members → custom task/no-go days → digest
-- preview) off this timestamp. Set once on the first upgrade and never moved,
-- so re-subscribing doesn't replay the sequence.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS paid_since timestamptz;
