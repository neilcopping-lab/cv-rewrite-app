-- Comquat accounts: Identify Your Options (Nov 2026).
--
-- Paste this whole file into Supabase: SQL Editor -> New query -> Run.
-- It is safe to run more than once.
--
-- One row per person: their answers in Identify Your Options (how they work
-- best, the strengths they picked with their examples, their values sort,
-- their life and interests, and the options they chose), so they can stop and
-- come back. The private "What helps me" notes live in their own column and are
-- never sent to the AI.
--
-- The row belongs to the signed-in person only: row level security means
-- nobody can read or change anyone else's, and it goes when the account is
-- deleted.

create table if not exists public.options_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb check (pg_column_size(answers) <= 200000),
  private_notes jsonb not null default '{}'::jsonb check (pg_column_size(private_notes) <= 20000),
  chosen jsonb not null default '[]'::jsonb check (pg_column_size(chosen) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.options_profiles enable row level security;
drop policy if exists "options_profiles own row" on public.options_profiles;
create policy "options_profiles own row" on public.options_profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
