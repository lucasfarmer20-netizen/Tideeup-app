-- 0014: stop exposing unclaimed (guest) plans through the public API.
--
-- Migration 0001 created the policy "unclaimed plans are publicly readable"
-- (using user_id is null). With the public anon key, anyone could list every
-- guest plan, including the household profile stored on it.
--
-- Nothing in the app depends on it: guest plans are read on the server with
-- the service role (plan page, print page, /api/plan/[planId]). Signed-in
-- owners keep "users can read own plans".

drop policy if exists "unclaimed plans are publicly readable" on plans;
