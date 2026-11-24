-- "My writing style": a description of how someone writes, learned from
-- three samples of their own writing. Shared with the other Comquat apps
-- (by confirmed email) so it only has to be set once. Only the description
-- is stored and shared, never the samples.
alter table public.profiles add column if not exists style_profile text;
alter table public.profiles add column if not exists style_learned_at timestamptz;
alter table public.profiles add column if not exists style_source text;   -- which Comquat app it was learned in

-- For the server only (the link between Comquat apps): the style saved for a
-- confirmed email, and saving one when it's newer than what's there.
create or replace function public.comquat_style_for_email(e text)
returns table (style_profile text, style_learned_at timestamptz, style_source text)
language sql stable security definer set search_path = public, auth as $$
  select p.style_profile, p.style_learned_at, p.style_source
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = lower(e) and u.email_confirmed_at is not null and p.style_profile is not null
  limit 1
$$;

create or replace function public.comquat_set_style_for_email(e text, prof text, learned timestamptz, src text)
returns boolean
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  select u.id into uid from auth.users u where lower(u.email) = lower(e) and u.email_confirmed_at is not null limit 1;
  if uid is null then return false; end if;
  update public.profiles
     set style_profile = left(prof, 2000), style_learned_at = learned, style_source = src
   where id = uid and (style_learned_at is null or style_learned_at < learned);
  return found;
end $$;

revoke all on function public.comquat_style_for_email(text) from public, anon, authenticated;
revoke all on function public.comquat_set_style_for_email(text, text, timestamptz, text) from public, anon, authenticated;
