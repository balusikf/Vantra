-- Applied to Vantra 2026-10-22. One-time schema reference for another deployment.
-- Supabase CLI was unavailable in this environment; this is not a CLI migration.
-- Existing owner-only watchlist RLS applies to these fields. No new grants are needed.
begin;
alter table public.watchlist
  add column personal_rating smallint check (personal_rating between 1 and 10),
  add column personal_note text not null default '' check (char_length(personal_note) <= 2000);
commit;
