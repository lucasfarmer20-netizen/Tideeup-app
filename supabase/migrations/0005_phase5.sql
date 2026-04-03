-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  TideeUp — Phase 5: paid features schema                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- ── Extend households ─────────────────────────────────────────────────────────

ALTER TABLE households
  ADD COLUMN IF NOT EXISTS members        text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS no_go_days     integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS season_override text    CHECK (
    season_override IN ('spring', 'summer', 'fall', 'winter')
  );

-- ── custom_tasks ──────────────────────────────────────────────────────────────
-- Paid feature. User-defined tasks merged into the library at plan-generation time.

CREATE TABLE IF NOT EXISTS custom_tasks (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             text        NOT NULL,
  zone              text        NOT NULL CHECK (zone IN (
    'kitchen', 'bathroom', 'bedroom', 'living', 'outdoor', 'laundry', 'general'
  )),
  frequency         text        NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  estimated_minutes integer     NOT NULL CHECK (estimated_minutes > 0),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_tasks_user_id_idx ON custom_tasks(user_id);

ALTER TABLE custom_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own custom tasks"
  ON custom_tasks
  USING (user_id IN (SELECT id FROM users WHERE email = (auth.jwt() ->> 'email')));

-- ── task_assignments ──────────────────────────────────────────────────────────
-- Stores per-plan, per-task member assignments.
-- task_id is the string Task.id from the library (e.g. 'vacuum-living').

CREATE TABLE IF NOT EXISTS task_assignments (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id     uuid        NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  task_id     text        NOT NULL,
  member_name text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, task_id)
);

CREATE INDEX IF NOT EXISTS task_assignments_plan_id_idx ON task_assignments(plan_id);

ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own task assignments"
  ON task_assignments
  USING (plan_id IN (
    SELECT p.id FROM plans p
    INNER JOIN users u ON u.id = p.user_id
    WHERE u.email = (auth.jwt() ->> 'email')
  ));
