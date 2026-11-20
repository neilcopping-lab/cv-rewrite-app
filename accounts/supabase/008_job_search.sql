-- Comquat accounts: My job search, the monthly check-in, the 12 month
-- closing rule with two warning emails, the profile photo and the jobs
-- someone is after.
--
-- Paste this whole file into Supabase: SQL Editor -> New query -> Run.
-- It is safe to run more than once.
--
--   profiles.search_status            'looking' or 'paused' (paused = "I've got a job")
--   profiles.search_changed_at        when they last changed it
--   profiles.checkin_clock_at         when the last check-in went (or when they
--                                     ticked the box); the next one is a month later
--   profiles.inactivity_final_warned_at
--                                     when the second "your account will close"
--                                     email went; cleared if they come back
--   profiles.photo_updated_at         set when they've added a photo (the photo
--                                     itself is in their private storage folder)
--   profiles.search_roles             the jobs they're after, as a JSON list (max 8)
--   subscriptions.checkin             the monthly check-in tick box (off unless
--                                     they tick it: PECR needs an active opt-in)
--
-- Only the server (with the secret key) writes these new columns, after
-- checking who is signed in or that a one-tap email link is genuine. Nothing
-- here widens what signed-in people can change through the API.

alter table public.profiles add column if not exists search_status text not null default 'looking';
alter table public.profiles drop constraint if exists profiles_search_status_check;
alter table public.profiles add constraint profiles_search_status_check check (search_status in ('looking', 'paused'));
alter table public.profiles add column if not exists search_changed_at timestamptz;
alter table public.profiles add column if not exists checkin_clock_at timestamptz;
alter table public.profiles add column if not exists inactivity_final_warned_at timestamptz;

alter table public.profiles add column if not exists photo_updated_at timestamptz;
alter table public.profiles add column if not exists search_roles text not null default '[]';
alter table public.profiles drop constraint if exists profiles_search_roles_check;
alter table public.profiles add constraint profiles_search_roles_check check (char_length(search_roles) <= 1000);

alter table public.subscriptions add column if not exists checkin boolean not null default false;

-- The consent log can now record ticking and unticking the check-in.
alter table public.consent_log drop constraint if exists consent_log_topic_check;
alter table public.consent_log add constraint consent_log_topic_check
  check (topic in ('loudspeaker','guides','dispatches','apprenticeships','terms','cv_confirm','cover_confirm','checkin'));
