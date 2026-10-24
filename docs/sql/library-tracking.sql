-- APPLIED 2026-10-22 through Supabase migration library_tracking_collections_and_seen_episodes.
-- Single-use deployment reference. Do not rerun on this project.
alter table public.watchlist
 add column watch_status text not null default 'planned' check (watch_status in ('planned','watching','completed','paused','dropped')),
 add column completed_at timestamptz;
create function private.set_watch_completion() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.watch_status='completed' then
  if tg_op='INSERT' then new.completed_at:=pg_catalog.clock_timestamp();
  elsif old.watch_status is distinct from 'completed' then new.completed_at:=pg_catalog.clock_timestamp();
  else new.completed_at:=old.completed_at; end if;
 else new.completed_at:=null; end if;
 return new;
end $$;
revoke all on function private.set_watch_completion() from public,anon,authenticated,service_role;
create trigger set_watch_completion before insert or update on public.watchlist for each row execute function private.set_watch_completion();
create table public.library_collections (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check (name=btrim(name) and char_length(name) between 1 and 50), created_at timestamptz not null default now()
);
create unique index library_collections_owner_name on public.library_collections(user_id,lower(name));
create table public.collection_items (
 collection_id uuid not null references public.library_collections(id) on delete cascade,
 watchlist_id uuid not null references public.watchlist(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 primary key(watchlist_id,collection_id)
);
create index collection_items_collection on public.collection_items(collection_id);
create index collection_items_owner on public.collection_items(user_id);
create table public.watched_episodes (
 watchlist_id uuid not null references public.watchlist(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 season integer not null check(season between 0 and 1000), episode integer not null check(episode between 1 and 100000),
 watched_at timestamptz not null default now(), primary key(watchlist_id,season,episode)
);
create index watched_episodes_owner on public.watched_episodes(user_id);
alter table public.library_collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.watched_episodes enable row level security;
revoke all on public.library_collections,public.collection_items,public.watched_episodes from public,anon,authenticated;
grant select,insert,delete on public.library_collections,public.collection_items,public.watched_episodes to authenticated;
grant update(name) on public.library_collections to authenticated;
create policy "Own collections" on public.library_collections for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "Own membership read" on public.collection_items for select to authenticated using(user_id=(select auth.uid()));
create policy "Own membership delete" on public.collection_items for delete to authenticated using(user_id=(select auth.uid()));
create policy "Own membership insert" on public.collection_items for insert to authenticated with check(
 user_id=(select auth.uid()) and exists(select 1 from public.watchlist w where w.id=watchlist_id and w.user_id=(select auth.uid()))
 and exists(select 1 from public.library_collections c where c.id=collection_id and c.user_id=(select auth.uid())));
create policy "Own seen read" on public.watched_episodes for select to authenticated using(user_id=(select auth.uid()));
create policy "Own seen delete" on public.watched_episodes for delete to authenticated using(user_id=(select auth.uid()));
create policy "Own seen insert" on public.watched_episodes for insert to authenticated with check(
 user_id=(select auth.uid()) and exists(select 1 from public.watchlist w where w.id=watchlist_id and w.user_id=(select auth.uid()) and (w.media_type='tv' or (w.media_type='anime' and season=0))));
create function public.unseen_library_episodes(candidates jsonb)
returns table(watchlist_id uuid,new_episodes bigint) language plpgsql stable security invoker set search_path='' as $$
begin
 if jsonb_typeof(candidates)<>'array' or jsonb_array_length(candidates)>2048 then raise exception 'Invalid candidate list' using errcode='22023'; end if;
 return query
 with releases as (select distinct r.watchlist_id,r.season,r.episode,r.released_at from jsonb_to_recordset(candidates) as r(watchlist_id uuid,season integer,episode integer,released_at timestamptz))
 select w.id,count(*) from releases r join public.watchlist w on w.id=r.watchlist_id
 where w.user_id=(select auth.uid()) and w.watch_status='completed' and r.released_at>w.completed_at and r.released_at<=now()
 and not exists(select 1 from public.watched_episodes e where e.watchlist_id=w.id and e.season=r.season and e.episode=r.episode)
 group by w.id;
end $$;
revoke all on function public.unseen_library_episodes(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.unseen_library_episodes(jsonb) to authenticated;
notify pgrst,'reload schema';
