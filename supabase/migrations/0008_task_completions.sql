-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  TideeUp — LTV task 1: per-task completion                                   │
-- └─────────────────────────────────────────────────────────────────────────────┘
--
-- Records each task a user checks off within a plan. Replaces the binary
-- "mark whole week done" with per-task, per-day check-offs so the app becomes
-- daily-use instead of weekly-glance.
--
-- A task id can appear on multiple days (daily stabilisers), so the natural key
-- is (plan_id, task_id, day_index). day_index is the 0-based index into
-- plans.week_plan.days for the day the task was scheduled.

CREATE TABLE IF NOT EXISTS task_completions (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id      uuid        NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Multi-tenancy: nullable today (consumer tier), populated for B2B in V2.
  tenant_id    uuid        REFERENCES tenants(id) ON DELETE SET NULL,
  task_id      text        NOT NULL,
  day_index    integer     NOT NULL CHECK (day_index BETWEEN 0 AND 6),
  -- Estimated active minutes for this task, snapshotted at check-off time so
  -- cumulative "hours invested" stats are a cheap SUM (dashboard, LTV task 2).
  minutes      integer     NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, task_id, day_index)
);

CREATE INDEX IF NOT EXISTS task_completions_plan_id_idx ON task_completions(plan_id);
CREATE INDEX IF NOT EXISTS task_completions_user_id_idx ON task_completions(user_id);

ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

-- API routes use the service role key (bypasses RLS). This policy covers future
-- direct client SDK access and mirrors the task_assignments policy.
CREATE POLICY "users can manage own task completions"
  ON task_completions
  USING (plan_id IN (
    SELECT p.id FROM plans p
    INNER JOIN users u ON u.id = p.user_id
    WHERE u.email = (auth.jwt() ->> 'email')
  ));
