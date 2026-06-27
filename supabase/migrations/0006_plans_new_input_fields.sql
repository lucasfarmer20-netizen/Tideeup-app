-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  TideeUp — Migration 0006: new PlannerInput fields on plans table           │
-- │                                                                             │
-- │  The engine rebuild (Phase 5+) replaced:                                   │
-- │    pets boolean          → pet_types text[]                                 │
-- │    time_preference '10'… → time_preference 'quick'|'steady'|…              │
-- │  And added:                                                                 │
-- │    home_type text                                                            │
-- │    flooring_types text[]                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Add new columns (nullable so existing rows are unaffected)
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS home_type      text,
  ADD COLUMN IF NOT EXISTS pet_types      text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS flooring_types text[]  NOT NULL DEFAULT '{}';

-- Migrate legacy pets boolean → pet_types array
-- Uses 'cat-1-2' as a generic fallback for any row where pets = true.
UPDATE plans
SET pet_types = ARRAY['cat-1-2']
WHERE pets = true AND array_length(pet_types, 1) IS NULL;

-- Widen the time_preference check constraint to accept both old and new values
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_time_preference_check;

ALTER TABLE plans
  ADD CONSTRAINT plans_time_preference_check CHECK (
    time_preference IN ('10', '20', '30', 'BATCH', 'quick', 'steady', 'thorough', 'batch')
  );
