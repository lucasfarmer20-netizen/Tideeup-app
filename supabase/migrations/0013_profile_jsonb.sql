-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  TideeUp — quiz v2: household profile (jsonb) + priorities                   │
-- └─────────────────────────────────────────────────────────────────────────────┘
--
-- The richer intake (adults, kids by age band, bathrooms, floors, weekly hours,
-- distribution) lives in one jsonb column so later profiling questions (Pro
-- depth: rooms, equipment, standards…) land in the same place without further
-- DDL. Shape is validated by the API (Zod) and typed by lib/engine/types.ts
-- HouseholdProfile. NULL = pre-v2 row; the engine derives from the coarse
-- columns, which are kept and still written.
--
-- priorities: the quiz's "what matters most" picks; the engine protects
-- matching tasks from degradation.

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS profile    jsonb,
  ADD COLUMN IF NOT EXISTS priorities text[] NOT NULL DEFAULT '{}';

ALTER TABLE households
  ADD COLUMN IF NOT EXISTS profile    jsonb,
  ADD COLUMN IF NOT EXISTS priorities text[] NOT NULL DEFAULT '{}';
