-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  TideeUp — households: carry the full quiz profile                          │
-- └─────────────────────────────────────────────────────────────────────────────┘
--
-- Migration 0006 added home_type / pet_types / flooring_types to `plans` only.
-- The plan-generate route and the settings regen have been writing and reading
-- those columns on `households` ever since, which failed silently: no household
-- row was created for users who signed in before taking the quiz, and settings
-- regenerated plans with default profile values. This adds the columns and
-- backfills them from each user's most recent claimed plan.

ALTER TABLE households
  ADD COLUMN IF NOT EXISTS home_type      text,
  ADD COLUMN IF NOT EXISTS pet_types      text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS flooring_types text[] NOT NULL DEFAULT '{}';

-- time_preference's check only allowed the legacy numeric labels; the engine
-- has written quick/steady/thorough/batch since phase 2, so every household
-- upsert from the quiz was also being rejected. Accept both vocabularies.
ALTER TABLE households DROP CONSTRAINT IF EXISTS households_time_preference_check;
ALTER TABLE households ADD CONSTRAINT households_time_preference_check
  CHECK (time_preference IN ('quick', 'steady', 'thorough', 'batch', '10', '20', '30', 'BATCH'));

-- Backfill: create or refresh a household row from the latest claimed plan.
WITH latest AS (
  SELECT DISTINCT ON (user_id)
    user_id, home_size, home_type, household_count, pets, pet_types, kids,
    flooring_types, time_preference
  FROM plans
  WHERE user_id IS NOT NULL
  ORDER BY user_id, created_at DESC
)
INSERT INTO households
  (user_id, home_size, home_type, household_count, pets, pet_types, kids, flooring_types, time_preference)
SELECT
  user_id, home_size, home_type, household_count, COALESCE(pets, false),
  COALESCE(pet_types, '{}'), COALESCE(kids, false), COALESCE(flooring_types, '{}'), time_preference
FROM latest
ON CONFLICT (user_id) DO UPDATE SET
  home_type      = COALESCE(households.home_type, EXCLUDED.home_type),
  pet_types      = CASE WHEN cardinality(households.pet_types) = 0 THEN EXCLUDED.pet_types ELSE households.pet_types END,
  flooring_types = CASE WHEN cardinality(households.flooring_types) = 0 THEN EXCLUDED.flooring_types ELSE households.flooring_types END;
