-- Comquat accounts: Your job hunt (one card per job, carried across CV Rewrite
-- and Interview Prep), This week's two, the follow-up kit, and Your story bank.
--
-- Paste this whole file into Supabase: SQL Editor -> New query -> Run.
-- It is safe to run more than once.
--
-- Both tables belong to the signed-in person only: Supabase's row level
-- security means nobody can read or change anyone else's rows, and the rows
-- go when the account is deleted.

create table if not exists public.job_hunt (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  company text not null default '' check (char_length(company) <= 200),
  advert text not null default '' check (char_length(advert) <= 30000),
  cv_text text not null default '' check (char_length(cv_text) <= 40000),
  status text not null default 'saved' check (status in ('saved','applied','interview','offer','no','withdrawn')),
  this_week boolean not null default false,
  fit text check (fit is null or fit in ('green','amber','red')),
  fit_note text check (fit_note is null or char_length(fit_note) <= 2000),
  applied_at timestamptz,
  interview_at timestamptz,
  heard_at timestamptz,
  chased_at timestamptz,
  thanked_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists job_hunt_user on public.job_hunt(user_id, updated_at desc);
alter table public.job_hunt enable row level security;
drop policy if exists "job_hunt own rows" on public.job_hunt;
create policy "job_hunt own rows" on public.job_hunt for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  situation text not null default '' check (char_length(situation) <= 3000),
  action text not null default '' check (char_length(action) <= 3000),
  result text not null default '' check (char_length(result) <= 3000),
  skills text not null default '' check (char_length(skills) <= 500),
  source text not null default 'me' check (source in ('me','cv_builder','cv_rewrite','interview_prep')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stories_user on public.stories(user_id, updated_at desc);
alter table public.stories enable row level security;
drop policy if exists "stories own rows" on public.stories;
create policy "stories own rows" on public.stories for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
