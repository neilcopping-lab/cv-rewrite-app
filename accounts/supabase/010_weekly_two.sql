-- Comquat accounts: the Monday "Which two this week?" email.
--
-- Paste this whole file into Supabase: SQL Editor -> New query -> Run.
-- It is safe to run more than once. Run 008 and 009 first if you haven't.
--
-- weekly_two is its own tick box, off for everyone until they tick it.
-- weekly_sent_at stops the email going twice in one week.

alter table public.subscriptions add column if not exists weekly_two boolean not null default false;
alter table public.subscriptions add column if not exists weekly_sent_at timestamptz;

-- Record consent for the Monday email separately, like the monthly check-in.
alter table public.consent_log drop constraint if exists consent_log_topic_check;
alter table public.consent_log add constraint consent_log_topic_check
  check (topic in ('loudspeaker','guides','dispatches','apprenticeships','terms','cv_confirm','cover_confirm','checkin','weekly_two'));
