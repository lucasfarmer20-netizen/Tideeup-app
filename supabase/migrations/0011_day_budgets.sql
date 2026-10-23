-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  TideeUp — Pro "Your week": per-day minute budgets                          │
-- └─────────────────────────────────────────────────────────────────────────────┘
--
-- Seven integers, Monday first (index 1 = Mon … 7 = Sun in Postgres' 1-based
-- arrays; the app maps to 0-based). Each 0–180. NULL means "not set" — the
-- engine falls back to the time_preference budget table, so free users and
-- untouched Pro accounts behave exactly as before. A 0 is a rest day and
-- supersedes no_go_days for that day.

ALTER TABLE households
  ADD COLUMN IF NOT EXISTS day_budgets integer[]
  CHECK (
    day_budgets IS NULL
    OR (
      array_length(day_budgets, 1) = 7
      AND 0 <= ALL(day_budgets)
      AND 180 >= ALL(day_budgets)
    )
  );
