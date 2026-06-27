# TideeUp — LTV Tasks (retention / lifetime-value roadmap)

Source: paid-feature audit against subscription-app LTV drivers (habit loop, visible
progress, switching cost, household buy-in, per-task completion). Build in order — each
later task assumes the per-task completion data from task 1.

## 1. Per-task completion
Per-task checkboxes (DB schema + API + UI). Replaces the binary "mark week done" with
daily check-offs. Streak becomes "days active this week" instead of "weeks completed."
The single biggest lever — makes the app daily-use instead of weekly-glance.

- DB: `task_completions` (plan_id, task_id, day_index, completed_at, user_id, tenant_id).
- API: toggle a task complete/incomplete; week auto-completes when all tasks done.
- UI: checkboxes per task on the plan page, with live progress.

## 2. Dashboard progress layer
Cumulative stats — total tasks completed, hours invested, current streak with milestones
("12 weeks — top 10% of households!") — plus a weekly progress ring that fills as tasks
get checked off.

## 3. Enhanced Sunday email
Personalize the digest: member assignments ("Brooke: bathroom, Lucas: kitchen"), last-week
completion rate ("you completed 85%"), and rotation insights. The #1 retention touchpoint.

## 4. "Coming back this week" rotation visibility
Surface tasks not done in a while on the dashboard ("last deep cleaned oven 6 weeks ago").
Makes the paid rotation memory visible — the killer differentiator.

## 5. Post-upgrade onboarding email sequence
3 emails over week 1: (1) welcome + set up members, (2) add first custom task + set no-go
days, (3) Sunday digest preview. Users who configure paid features in week 1 churn at
half the rate.
