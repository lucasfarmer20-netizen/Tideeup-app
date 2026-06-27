-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  TideeUp — Migration 0007: clear stale no_go_days data                      │
-- │                                                                             │
-- │  During early development some households were written with test values      │
-- │  for no_go_days (e.g. [4] = Thursday). This caused those days to show        │
-- │  zero budget even though no no-go day was intentionally configured.          │
-- │                                                                             │
-- │  This migration resets no_go_days to an empty array for all rows that        │
-- │  have values other than the expected empty/null state. Safe to re-run.       │
-- └─────────────────────────────────────────────────────────────────────────────┘

UPDATE households
SET no_go_days = '{}'
WHERE no_go_days IS NOT NULL
  AND array_length(no_go_days, 1) > 0;
