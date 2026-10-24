-- Owner-only, six-title continuation snapshot. No playback completion is inferred.
create or replace function public.continue_watching_candidates()
returns jsonb language sql stable security invoker set search_path='' as $$
with history as materialized (
 select tmdb_id,media_type,title,poster_path,season,episode,last_watched
 from public.watch_history where user_id=(select auth.uid()) order by last_watched desc,id limit 24
), marks as materialized (
 select watchlist_id,max(watched_at) as last_mark,count(*) as marked_count
 from public.watched_episodes where user_id=(select auth.uid()) group by watchlist_id
), choices as (
 select w.id as saved_id,w.tmdb_id as id,w.media_type as kind,w.title,w.poster_path as poster,
  w.watch_status as status,w.completed_at,h.season as history_season,h.episode as history_episode,
  greatest(w.added_at,w.completed_at,h.last_watched,m.last_mark) as activity_at,coalesce(m.marked_count,0) as marked_count
 from public.watchlist w left join history h on h.tmdb_id=w.tmdb_id and h.media_type=w.media_type
 left join marks m on m.watchlist_id=w.id
 where w.user_id=(select auth.uid()) and w.watch_status not in ('paused','dropped')
  and not(w.media_type='movie' and w.watch_status='completed')
  and (w.watch_status in ('watching','completed') or h.tmdb_id is not null or m.watchlist_id is not null)
 union all
 select null::uuid,h.tmdb_id,h.media_type,h.title,h.poster_path,null::text,null::timestamptz,h.season,h.episode,h.last_watched,0::bigint
 from history h where not exists(select 1 from public.watchlist w where w.user_id=(select auth.uid()) and w.tmdb_id=h.tmdb_id and w.media_type=h.media_type)
), picked as materialized (
 select * from choices order by case when status='completed' then 1 else 0 end,activity_at desc,id,kind limit 6
), numbered as (
 select e.watchlist_id,e.season,e.episode,row_number() over(partition by e.watchlist_id,e.season order by e.episode) as position
 from public.watched_episodes e join picked p on p.saved_id=e.watchlist_id
 where e.user_id=(select auth.uid())
), seen_ranges as (
 select watchlist_id,season,min(episode) as first,max(episode) as last
 from numbered group by watchlist_id,season,episode-position
), season_marks as (
 select watchlist_id,season,count(*) as count,coalesce(min(position) filter(where episode<>position),count(*)+1) as first_unwatched
 from numbered group by watchlist_id,season
)
select jsonb_build_object('items',coalesce(jsonb_agg(
 jsonb_build_object('saved_id',p.saved_id,'id',p.id,'kind',p.kind,'title',p.title,'poster',p.poster,'status',p.status,
 'completed_at',p.completed_at,'history_season',p.history_season,'history_episode',p.history_episode,'marked_count',p.marked_count,
 'seasons',coalesce((select jsonb_agg(jsonb_build_object('season',s.season,'count',s.count,'first_unwatched',s.first_unwatched,'ranges',(select jsonb_agg(jsonb_build_array(r.first,r.last) order by r.first) from seen_ranges r where r.watchlist_id=s.watchlist_id and r.season=s.season)) order by s.season) from season_marks s where s.watchlist_id=p.saved_id),'[]'::jsonb))
 order by case when p.status='completed' then 1 else 0 end,p.activity_at desc,p.id,p.kind),'[]'::jsonb))
from picked p;
$$;
revoke all on function public.continue_watching_candidates() from public,anon,authenticated,service_role;
grant execute on function public.continue_watching_candidates() to authenticated;
notify pgrst,'reload schema';
