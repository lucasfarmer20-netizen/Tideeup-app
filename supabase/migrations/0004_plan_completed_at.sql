-- Add completed_at to plans so history can show completed weeks regardless of week_of date
ALTER TABLE plans ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS plans_completed_at_idx ON plans(completed_at) WHERE completed_at IS NOT NULL;
