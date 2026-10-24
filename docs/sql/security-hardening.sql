-- APPLIED to VANTRA on 2026-10-22 after a transactional rehearsal and verification.
-- Single-use deployment reference, NOT an unapplied Supabase CLI migration.
-- Do not rerun on this project: functions, schema and constraints already exist.
-- For a fresh deployment, inspect its starting schema and rehearse with verification first.
-- Does not change account credentials, existing row contents or Storage object metadata.
-- Bucket settings were applied separately through the Storage dashboard/API:
-- avatars stays public; file_size_limit=2097152; MIME=image/jpeg,image/png,image/webp.

begin;

create schema private;
revoke all on schema private from public, anon, authenticated, service_role;
alter function public.check_email_whitelist() set schema private;
alter function public.handle_new_user() set schema private;
alter function public.rls_auto_enable() set schema private;
create or replace function private.check_email_whitelist()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
begin
  if not exists (select 1 from public.allowed_emails where email = new.email) then
    raise exception 'Email nie je na whiteliste';
  end if;
  return new;
end;
$fn$;
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
begin
  insert into public.profiles(id,email,display_name)
  values (new.id,new.email,pg_catalog.left(pg_catalog.split_part(new.email,'@',1),60));
  return new;
end;
$fn$;
revoke execute on function private.check_email_whitelist(), private.handle_new_user(), private.rls_auto_enable()
from public, anon, authenticated, service_role;
revoke create on schema public from public, anon, authenticated;
revoke all on public.profiles, public.allowed_emails, public.watchlist, public.watch_history
from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update(display_name,avatar_url) on public.profiles to authenticated;
grant select,insert,update,delete on public.watchlist,public.watch_history to authenticated;
alter policy "Own profile only" on public.profiles to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
alter policy "Own watchlist only" on public.watchlist to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "Own history only" on public.watch_history to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter table public.watchlist alter column user_id set not null, alter column media_type set not null;
alter table public.watch_history alter column user_id set not null, alter column media_type set not null;
alter table public.profiles
  add constraint profiles_display_name_length check (char_length(display_name) <= 60),
  add constraint profiles_avatar_url_length check (char_length(avatar_url) <= 2048);
alter policy "Avatar read" on storage.objects to authenticated
using (bucket_id='avatars' and owner_id=(select auth.uid()::text));
alter policy "Avatar upload" on storage.objects to authenticated
with check (bucket_id='avatars' and owner_id=(select auth.uid()::text)
  and (storage.foldername(name))[1]=(select auth.uid()::text));
alter policy "Avatar update" on storage.objects to authenticated
using (bucket_id='avatars' and owner_id=(select auth.uid()::text))
with check (bucket_id='avatars' and owner_id=(select auth.uid()::text)
  and (storage.foldername(name))[1]=(select auth.uid()::text));
alter policy "Avatar delete" on storage.objects to authenticated
using (bucket_id='avatars' and owner_id=(select auth.uid()::text));

commit;
