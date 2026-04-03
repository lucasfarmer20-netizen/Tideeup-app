# TideeUp — Project Brief

## What it is

TideeUp is a subscription SaaS household planning engine for families with kids. It generates a personalised weekly cleaning and maintenance plan based on how a family actually lives — home size, number of people, pet types, flooring materials, and how much time they realistically want to spend cleaning each week.

The core experience is a short quiz (2–3 minutes) that produces a prioritised, day-by-day plan. No generic checklists. The plan adapts to the household's profile and, for paid users, learns over time through rotation memory so the same tasks don't pile up on the same days every week.

---

## Target user

Busy families with kids, ages 28–45. Both parents working. Enough going on that cleaning feels like a source of friction, not just a chore. They want a system that handles the thinking so they don't have to.

---

## Monetisation

| Tier | Price | What you get |
|---|---|---|
| Free | $0 (email required) | One generated plan, no persistence |
| Pro Monthly | $7 / mo | Everything below |
| Pro Annual | $60 / yr | Everything below (saves ~$24) |

**Paid features:** rotation memory, household member assignment, task history, custom tasks, season mode, no-go days, Sunday weekly email digest.

---

## Business context

- Bootstrapped — no outside funding.
- EDWOSB LLC being formed. Brooke is primary owner at 51%+.
- Domain: **tideeup.com**
- B2B white-label partnerships planned for V2 — cleaning product brands and household subscription services licensing the engine under their own brand.

---

## Tech stack

| | |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS + shadcn/ui |
| Auth | Supabase (magic link / OTP, no passwords) |
| Database | Supabase Postgres |
| Payments | Stripe (subscriptions, checkout, customer portal) |
| Email | Resend |
| Hosting | Vercel |
| PWA | Yes |

---

## Build status

| Phase | Status | Summary |
|---|---|---|
| 1 | Complete | Pure TypeScript planning engine — stateless, deterministic, fully tested |
| 2 | Complete | Next.js UI, Supabase schema, Stripe integration, quiz → plan flow |
| 3 | Complete | Email capture gate, anonymous plan claim on sign-in |
| 4 | Complete | Households table, rotation state, streaks, plan history |
| 5 | Complete | Paid features: custom tasks, member assignment, season override, no-go days |
| Current | In progress | Rebuilding task library (more tasks, better coverage, improved scoring) |
| V2 | Not started | B2B white-label / multi-tenant onboarding |

---

## How the engine works

The planner takes a `PlannerInput` (home profile + week date) and returns a `WeekPlan` — seven `DayPlan` objects, each with a list of tasks and a time budget. The engine is pure TypeScript with no database or network calls; it runs the same whether invoked from an API route or a test.

Key inputs that shape the plan:
- **Home size** (S / M / L / XL) — scales task durations
- **Home type** (apartment / townhouse / single-family / large-home) — filters relevant tasks
- **Household count** — 6+ people triggers a 1.4× time multiplier on shared spaces
- **Pet types** — specific task variants surface for cat owners, dog owners, etc.
- **Flooring types** — hardwood, carpet, tile, or mixed affects vacuuming and mopping tasks
- **Time preference** — quick (light daily effort), steady, thorough, or batch (light weekdays, heavy weekend)
- **Kids** — surfaces kid-specific tasks
- **Season** — auto-detected from date, or manually overridden by paid users
- **Rotation state** (paid) — tracks recently completed tasks to avoid repetition

---

## Multi-tenancy

The database schema includes a `tenants` table and nullable `tenant_id` on all core tables from day one. Consumer users have `tenant_id = NULL`. V2 B2B users will have a tenant row. This was a deliberate architecture decision — retrofitting multi-tenancy later is expensive.
