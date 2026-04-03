-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  TideeUp — initial schema                                                   │
-- │  Run in: Supabase SQL Editor > Run                                          │
-- │  Or: supabase db push (with Supabase CLI)                                   │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ── tenants ───────────────────────────────────────────────────────────────────
-- B2B multi-tenancy support (Phase 2 launches without tenants — nullable everywhere).
create table tenants (
  id         uuid        primary key default uuid_generate_v4(),
  name       text        not null,
  slug       text        unique not null,
  created_at timestamptz not null default now()
);

-- ── users ─────────────────────────────────────────────────────────────────────
create table users (
  id           uuid        primary key default uuid_generate_v4(),
  email        text        unique not null,
  tenant_id    uuid        references tenants(id) on delete set null,
  email_status text        not null default 'pending'
                           check (email_status in ('pending', 'sent', 'opened', 'unsubscribed')),
  is_paid      boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index users_tenant_id_idx on users(tenant_id);
create index users_email_idx     on users(email);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on users
  for each row execute function update_updated_at();

-- ── plans ─────────────────────────────────────────────────────────────────────
create table plans (
  id               uuid    primary key default uuid_generate_v4(),
  -- Nullable: plan exists before user claims it (quiz → result → email gate)
  user_id          uuid    references users(id) on delete set null,
  tenant_id        uuid    references tenants(id) on delete set null,

  -- PlannerInput snapshot
  home_size        text    not null check (home_size in ('S', 'M', 'L', 'XL')),
  household_count  int     not null check (household_count between 1 and 6),
  pets             boolean not null default false,
  kids             boolean not null default false,
  -- Stored as text to match engine's TimePreference union (10|20|30|'BATCH')
  time_preference  text    not null check (time_preference in ('10', '20', '30', 'BATCH')),
  week_of          date    not null,

  -- Full SerializedWeekPlan output — avoids a complex normalized task schema.
  -- Query pattern is always "fetch one plan by ID", never "filter by task".
  week_plan        jsonb   not null,

  is_claimed       boolean not null default false,
  created_at       timestamptz not null default now()
);

create index plans_user_id_idx    on plans(user_id);
create index plans_tenant_id_idx  on plans(tenant_id);
create index plans_created_at_idx on plans(created_at desc);

-- ── email_events ──────────────────────────────────────────────────────────────
-- Append-only log for Resend webhook events. Enables idempotent status updates.
create table email_events (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        not null references users(id) on delete cascade,
  event_type  text        not null,  -- 'queued' | 'sent' | 'opened' | 'clicked' | 'bounced'
  resend_id   text,                  -- Resend message ID (for deduplication)
  payload     jsonb,
  occurred_at timestamptz not null default now()
);

create index email_events_user_id_idx on email_events(user_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- API routes use the service role key → bypass RLS.
-- These policies govern Supabase client SDK access (future auth integration).

alter table tenants      enable row level security;
alter table users        enable row level security;
alter table plans        enable row level security;
alter table email_events enable row level security;

-- Unclaimed plans are publicly readable by anyone with the planId (UUID = access token)
create policy "unclaimed plans are publicly readable"
  on plans for select
  using (user_id is null);

-- Authenticated users can read their own plans
create policy "users can read own plans"
  on plans for select
  using (auth.uid() = user_id);

-- Authenticated users can read their own profile
-- Note: public.users.id is independent of auth.users UUID, so match by email
create policy "users can read own row"
  on users for select
  using (email = (auth.jwt() ->> 'email'));

-- Authenticated users can update their own email_status
create policy "users can update own email_status"
  on users for update
  using (email = (auth.jwt() ->> 'email'))
  with check (email = (auth.jwt() ->> 'email'));
