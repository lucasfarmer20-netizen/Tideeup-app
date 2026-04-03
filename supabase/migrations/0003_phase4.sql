-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  TideeUp — Phase 4: households, streaks, rotation state                     │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- ── households ────────────────────────────────────────────────────────────────
-- Stores the user's household configuration and rotation state between weeks.
-- Created/updated by /api/user/capture from the quiz answers.
-- Read by the Sunday email cron to generate each user's plan.

create table households (
  id              uuid        primary key default uuid_generate_v4(),
  user_id         uuid        not null unique references users(id) on delete cascade,
  home_size       text        not null check (home_size in ('S', 'M', 'L', 'XL')),
  household_count int         not null check (household_count between 1 and 6),
  pets            boolean     not null default false,
  kids            boolean     not null default false,
  time_preference text        not null check (time_preference in ('10', '20', '30', 'BATCH')),
  -- Paid feature: rotator state persisted between plan completions
  rotation_state  jsonb,
  -- Total weeks ever completed (used to calculate longest streak)
  completed_weeks int         not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index households_user_id_idx on households(user_id);

create trigger households_updated_at
  before update on households
  for each row execute function update_updated_at();

-- ── streaks ───────────────────────────────────────────────────────────────────
-- One row per user. Updated by /api/plan/complete.
-- current_streak resets if last_completed_week is more than 8 days ago.

create table streaks (
  id                   uuid        primary key default uuid_generate_v4(),
  user_id              uuid        not null unique references users(id) on delete cascade,
  current_streak       int         not null default 0,
  longest_streak       int         not null default 0,
  -- Monday of the most recently completed week (ISO date)
  last_completed_week  date,
  updated_at           timestamptz not null default now()
);

create index streaks_user_id_idx on streaks(user_id);

create trigger streaks_updated_at
  before update on streaks
  for each row execute function update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- API routes use the service role key (bypasses RLS).
-- These policies cover future direct client SDK access.

alter table households enable row level security;
alter table streaks    enable row level security;

create policy "users can read own household"
  on households for select
  using (user_id in (select id from users where email = auth.jwt() ->> 'email'));

create policy "users can read own streak"
  on streaks for select
  using (user_id in (select id from users where email = auth.jwt() ->> 'email'));
