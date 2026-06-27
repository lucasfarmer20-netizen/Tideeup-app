# TideeUp — Claude Code Instructions

## What is TideeUp

Subscription-based household planning SaaS. Families answer a short quiz about their home (size, flooring, pets, household count, time budget) and receive a personalised weekly cleaning/task plan. Free tier is ephemeral (quiz → plan, no account required). Paid tier (~$7/mo) adds rotation memory, member assignment, history, custom tasks, season mode, and a weekly Sunday email digest. V2 targets B2B white-label partnerships.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, React 19) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 3 + shadcn/ui |
| Auth | Supabase Auth (magic link / OTP — no passwords) |
| Database | Supabase Postgres (RLS enforced) |
| Payments | Stripe (subscription, checkout, customer portal, webhooks) |
| Email | Resend |
| Hosting | Vercel |
| Tests | Vitest 2.x (ESM, node env) |
| Package manager | npm |

---

## Build status by phase

| Phase | Status | What was built |
|---|---|---|
| 1 | Complete | Pure TypeScript planning engine — `lib/engine/`, `lib/tasks/`. No UI, no DB, no I/O. 140 Vitest tests passing. |
| 2 | Complete | Next.js App Router UI, Supabase schema (initial + Stripe billing fields), auth flow, quiz → plan flow. |
| 3 | Complete | Email capture gate for free tier; anonymous plan claim on sign-in. |
| 4 | Complete | `households` table, streaks, rotation state, `plans.completed_at`. |
| 5 | Complete | Paid features schema: `custom_tasks`, `task_assignments`, `members`, `no_go_days`, `season_override`. Dashboard, history, settings pages. |
| V2 | Not started | B2B white-label / multi-tenant onboarding. |

---

## Key architectural decisions

**Stateless pure engine.** `lib/engine/` has zero I/O. `generateWeekPlan(input) → WeekPlan` is deterministic — same input, same output, every time. All Supabase reads/writes happen in API routes *before* and *after* the engine call, never inside it. Do not add DB calls or HTTP to the engine.

**Anonymous-first plan flow.** A user can complete the quiz and get a plan without an account. The plan is saved to Supabase with `user_id = null`. A `pending_plan_id` cookie is set. When the user later signs in, `app/auth/callback/route.ts` claims the plan by setting `user_id` and `is_claimed = true` and upserting their `households` row.

**Supabase `public.users` mirrors `auth.users`.** Our application logic reads from `public.users` (joined with `households`, `plans`, etc.), not `auth.users`. The `public.users` row is created on first quiz submission if the user is authenticated, or on first sign-in for anonymous users. The link is by `email`.

**Admin client bypasses RLS.** `lib/supabase/server.ts` exports `createAdminClient()` using the service role key. It is imported with `import 'server-only'` so it cannot leak to client bundles. Use it in API routes and server-only cron jobs. Never use it in Server Components that render untrusted data.

**Multi-tenancy is nullable, not absent.** `tenants`, `users`, and `plans` tables all have `tenant_id` columns today (nullable). V2 will populate them. Every query must be written so adding a `tenant_id` filter is a one-line change — never assume `tenant_id IS NULL` means "no tenant"; it means "consumer tier".

---

## Auth flow

1. User submits email at `/auth/signin` → `POST /api/auth/signin` → Supabase sends magic link email with 8-digit OTP.
2. User enters OTP at `/auth/verify` (or clicks email link which auto-submits via URL param `?code=`).
3. `supabase.auth.verifyOtp()` establishes a session in cookies via `@supabase/ssr`.
4. On sign-in via email link, Supabase redirects to `/auth/callback?code=<auth_code>&next=<dest>`.
5. `app/auth/callback/route.ts` exchanges the code for a session, then checks for a `pending_plan_id` cookie and claims the anonymous plan if present, then redirects to `next` (or `/dashboard`).
6. `middleware.ts` runs `supabase.auth.getUser()` on every request to keep the session cookie fresh.
7. Protected pages live under `app/(authenticated)/`. The route group layout redirects to `/quiz` if no session.

---

## Feature gating

Feature access is gated on `users.tier` in the DB.

```
users.tier = 'free'  → default; ephemeral plans only
users.tier = 'paid'  → rotation memory, custom tasks, history, member assignment, season override, no-go days, weekly email
```

In API routes, after reading `userRow`, check:
```ts
const isPaidUser = userRow?.tier === 'paid';
```

Stripe webhook (`app/api/stripe/webhook/route.ts`) sets `tier = 'paid'` on `checkout.session.completed` and reverts it on `customer.subscription.deleted`. Never gate features on Stripe data directly — always read `users.tier`.

---

## Multi-tenancy design

- `tenants` table exists from migration 0001. Every other table (`users`, `plans`, `households`, `custom_tasks`) has a nullable `tenant_id` FK.
- Consumer users have `tenant_id = NULL`. B2B users will have a `tenant_id`.
- RLS policies must always include a tenant-safe predicate. Do not write policies that only check `user_id` without considering that two tenants could theoretically have users with the same auth identity in a future SSO scenario.
- **Never hard-code tenant assumptions.** Any new table must include `tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL`.

---

## Dev environment — three terminal windows

You need three terminals running simultaneously for full local dev:

**Window 1 — Next.js dev server**
```
npm run dev
```
Runs at `http://localhost:3000`.

**Window 2 — Stripe webhook forwarding**
```
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
Required for any Stripe event (checkout, subscription updates) to reach the local app. Copy the webhook signing secret it prints and set it as `STRIPE_WEBHOOK_SECRET` in `.env.local`.

**Window 3 — Tests (optional watch mode)**
```
npm run test
```
Vitest watch mode for engine changes. Run `npm run test:run` for a single pass before committing.

---

## Environment variables

Create `.env.local` in the project root. All values are required in production.

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API → service_role key (secret — never expose client-side) |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | Printed by `stripe listen` locally; or Stripe dashboard → Developers → Webhooks → signing secret for prod endpoint |
| `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID` | Stripe dashboard → Products → TideeUp Pro → Monthly price ID |
| `NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID` | Stripe dashboard → Products → TideeUp Pro → Annual price ID |
| `RESEND_API_KEY` | Resend dashboard → API Keys |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally; production domain on Vercel |

---

## Known issues / gotchas

- **`createAdminClient` has no Database generic.** `lib/supabase/server.ts` intentionally omits the `Database` type parameter until `supabase gen types typescript` is wired up via Supabase CLI. API routes cast query results explicitly to expected shapes. When the CLI is configured, restore the generic.
- **`plans` schema drift.** Early migrations stored `pets: boolean` and `time_preference` as `'10'|'20'|'30'|'BATCH'`. The engine now uses `petTypes: PetType[]` and `timePreference: 'quick'|'steady'|'thorough'|'batch'`. New plans use the new schema; old persisted plans may have legacy values.
- **Anonymous plan claim is best-effort.** If the `auth/callback` plan-claim step fails (DB error, schema mismatch), it logs and continues — the user lands on the dashboard but the plan may not appear until a refresh or a re-run of the quiz. This is intentional; the auth flow must not break due to a claim failure.
- **`stripe listen` webhook secret changes each session.** Update `STRIPE_WEBHOOK_SECRET` in `.env.local` whenever you restart `stripe listen` locally, or set up a fixed local endpoint in the Stripe dashboard.
- **Migration runner.** Apply migrations with `npm run db:migrate` (script: `scripts/migrate.mjs`). It connects via `SUPABASE_DB_URL` (direct Postgres connection string, port 5432), tracks applied files in a `schema_migrations` table, and runs each pending `supabase/migrations/*.sql` once in its own transaction. `npm run db:migrate:status` lists applied/pending. On a database that was provisioned by hand before the runner existed, run `npm run db:migrate:baseline -- <file>` once (note the `--` so npm forwards the filename) to mark everything up to `<file>` as applied without re-running it, then `npm run db:migrate` for the rest. The Supabase CLI / `supabase db push` workflow is intentionally not used.

---

## Code conventions

- TypeScript strict — no `any`, no `!` assertions without an explanatory comment.
- Zod for all external input validation (API routes, form data).
- Server Components by default; add `"use client"` only when interactivity requires it.
- `shadcn/ui` for UI primitives; extend with Tailwind utilities, not custom CSS.
- All Supabase queries in Server Components and API routes must respect RLS. Only `createAdminClient()` may bypass RLS, and only in trusted server-only contexts.
- Engine changes require updating tests in `lib/engine/__tests__/` in the same changeset.
