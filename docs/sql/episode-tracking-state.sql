-- Single-use deployment reference for VANTRA, 2026-10-24.
-- One owner-scoped read replaces the title lookup, counts and season marks.
begin;
create function public.episode_tracking_state(target_id integer, target_kind text, target_season integer, max_episode integer)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare saved uuid; result jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Unauthorized' using errcode='42501'; end if;
  if target_id is null or target_id < 1 or target_kind is null or target_kind not in ('tv','anime')
    or target_season is null or target_season not between 0 and 1000 or (target_kind='anime' and target_season<>0)
    or max_episode is null or max_episode not between 1 and 100000 then
    raise exception 'Invalid episode request' using errcode='22023';
  end if;
  select w.id into saved from public.watchlist w
    where w.user_id=(select auth.uid()) and w.tmdb_id=target_id and w.media_type=target_kind;
  with grouped as (
    select e.season, count(*) as total,
      coalesce(jsonb_agg(e.episode order by e.episode) filter (where e.season=target_season and e.episode<=max_episode),'[]'::jsonb) as seen
    from public.watched_episodes e
    where e.user_id=(select auth.uid()) and e.watchlist_id=saved group by e.season
  )
  select jsonb_build_object('watchlistId',saved,
    'seasonCounts',coalesce((select jsonb_object_agg(g.season,g.total) from grouped g),'{}'::jsonb),
    'seen',coalesce((select g.seen from grouped g where g.season=target_season),'[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.episode_tracking_state(integer,text,integer,integer) from public, anon, authenticated, service_role;
grant execute on function public.episode_tracking_state(integer,text,integer,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
