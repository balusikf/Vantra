-- Applied deployment reference: library presentation and season summaries.
begin;
alter table public.library_collections add column cover_watchlist_id uuid;
alter table public.collection_items add column position integer not null default 1000000 check(position between 0 and 1000000);
alter table public.library_collections add constraint collection_cover_member foreign key(cover_watchlist_id,id) references public.collection_items(watchlist_id,collection_id) on delete set null(cover_watchlist_id);
create index library_collections_cover_member on public.library_collections(cover_watchlist_id,id);
create index collection_items_position on public.collection_items(collection_id,position,watchlist_id);
grant update(cover_watchlist_id) on public.library_collections to authenticated;
grant update(position) on public.collection_items to authenticated;
create policy "Own membership order" on public.collection_items for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create function public.collection_summaries()
returns table(id uuid,name text,cover_watchlist_id uuid,member_count bigint,posters jsonb)
language sql stable security invoker set search_path='' as $$
 select c.id,c.name,c.cover_watchlist_id,
 (select count(*) from public.collection_items ci where ci.collection_id=c.id and ci.user_id=(select auth.uid())),
 coalesce((select jsonb_agg(p.item) from (
 select jsonb_build_object('id',w.id,'title',w.title,'media_type',w.media_type,'poster_path',w.poster_path) item
 from public.collection_items ci join public.watchlist w on w.id=ci.watchlist_id
 where ci.collection_id=c.id and ci.user_id=(select auth.uid()) and w.user_id=(select auth.uid())
 order by (w.id=c.cover_watchlist_id) desc nulls last,ci.position,ci.watchlist_id limit 4
 ) p),'[]'::jsonb)
 from public.library_collections c where c.user_id=(select auth.uid()) order by c.name,c.id;
$$;
create function public.set_collection_order(target_collection uuid,ordered_ids uuid[])
returns void language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if auth.uid() is null or ordered_ids is null or cardinality(ordered_ids)>2000 then raise exception 'Invalid collection order' using errcode='22023'; end if;
 perform 1 from public.library_collections where id=target_collection and user_id=(select auth.uid()) for update;
 if not found then raise exception 'Collection unavailable' using errcode='42501'; end if;
 n:=cardinality(ordered_ids);
 if n<>(select count(distinct v) from unnest(ordered_ids) v)
 or n<>(select count(*) from public.collection_items where collection_id=target_collection and user_id=(select auth.uid()))
 or n<>(select count(*) from public.collection_items where collection_id=target_collection and user_id=(select auth.uid()) and watchlist_id=any(ordered_ids))
 then raise exception 'Collection changed. Reload before arranging.' using errcode='22023'; end if;
 update public.collection_items ci set position=o.ordinality::integer
 from unnest(ordered_ids) with ordinality o(id,ordinality)
 where ci.collection_id=target_collection and ci.watchlist_id=o.id and ci.user_id=(select auth.uid());
end $$;
create function public.episode_season_counts(target_watchlist uuid)
returns table(season integer,total bigint) language sql stable security invoker set search_path='' as $$
 select e.season,count(*) from public.watched_episodes e
 where e.watchlist_id=target_watchlist and e.user_id=(select auth.uid()) group by e.season;
$$;
revoke all on function public.collection_summaries(),public.set_collection_order(uuid,uuid[]),public.episode_season_counts(uuid) from public,anon,authenticated,service_role;
grant execute on function public.collection_summaries(),public.set_collection_order(uuid,uuid[]),public.episode_season_counts(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
