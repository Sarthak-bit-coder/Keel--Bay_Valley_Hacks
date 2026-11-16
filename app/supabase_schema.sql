-- Keel "My pay" accounts. Paste into Supabase: SQL Editor -> New query -> Run. Safe to run twice.
-- Row Level Security means every signed-in person can only read and change their own rows,
-- so the public "anon" key in app/config.js is safe to ship in the page.

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  job          text not null default 'other' check (char_length(job) <= 40),
  tax_rate     numeric not null default 0.15 check (tax_rate >= 0 and tax_rate < 1),
  risk_limit   numeric not null default 0.05 check (risk_limit in (0.01, 0.05, 0.10, 0.20)),
  updated_at   timestamptz not null default now()
);

create table if not exists public.pay_entries (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),  -- always a Monday
  gross      numeric(10, 2) not null check (gross >= 0 and gross < 100000),
  note       text not null default '' check (char_length(note) <= 80),
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.profiles enable row level security;
alter table public.pay_entries enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own pay" on public.pay_entries;
create policy "own pay" on public.pay_entries
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
