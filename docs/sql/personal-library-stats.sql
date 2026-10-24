-- Personal statistics: read-only, owner-scoped summary. No event log or new table.
create or replace function public.personal_library_stats(report_timezone text default 'UTC')
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if (select auth.uid()) is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if report_timezone is null or length(report_timezone)>64 or not exists(select 1 from pg_catalog.pg_timezone_names where name=report_timezone) then raise exception 'Invalid timezone' using errcode='22023'; end if;
 with bounds as (
  select date_trunc('month',current_timestamp at time zone report_timezone) as this_month
 ), months as (
  select to_char(b.this_month-(n*interval '1 month'),'YYYY-MM') as month from bounds b cross join generate_series(0,11) n
 ), owned as materialized (
  select id,tmdb_id,media_type,title,poster_path,added_at,personal_rating,watch_status,completed_at,
   length(btrim(personal_note))>0 as has_note
  from public.watchlist where user_id=(select auth.uid())
 ), scoped as materialized (
  select 'all'::text as kind,o.* from owned o union all select o.media_type as kind,o.* from owned o
 ), seen as materialized (
  select o.media_type,e.watched_at from public.watched_episodes e join owned o on o.id=e.watchlist_id
  where e.user_id=(select auth.uid())
 ), seen_scoped as (
  select 'all'::text as kind,watched_at from seen union all select media_type,watched_at from seen
 ), totals as (
  select kind,count(*) as total,count(personal_rating) as rated,round(avg(personal_rating),2) as average_rating,
   count(*) filter(where has_note) as notes,
   jsonb_build_object('planned',count(*) filter(where watch_status='planned'),'watching',count(*) filter(where watch_status='watching'),
    'completed',count(*) filter(where watch_status='completed'),'paused',count(*) filter(where watch_status='paused'),'dropped',count(*) filter(where watch_status='dropped')) as statuses,
   jsonb_build_object('movie',count(*) filter(where media_type='movie'),'tv',count(*) filter(where media_type='tv'),'anime',count(*) filter(where media_type='anime')) as media
  from scoped group by kind
 ), ranks as (
  select kind,tmdb_id,media_type,title,poster_path,personal_rating,
   row_number() over(partition by kind order by personal_rating desc,added_at desc,id) as rank
  from scoped where personal_rating is not null
 ), top_titles as (
  select kind,jsonb_agg(jsonb_build_object('id',tmdb_id,'kind',media_type,'title',title,'poster',poster_path,'rating',personal_rating) order by rank) as titles
  from ranks where rank<=6 group by kind
 ), rating_counts as (
  select kind,personal_rating,count(*) as count from scoped where personal_rating is not null group by kind,personal_rating
 ), events as (
  select kind,to_char(added_at at time zone report_timezone,'YYYY-MM') as month,1::bigint as saved,0::bigint as completed,0::bigint as episodes from scoped,bounds
   where added_at>=((this_month-interval '11 months') at time zone report_timezone) and added_at<=current_timestamp
  union all
  select kind,to_char(completed_at at time zone report_timezone,'YYYY-MM'),0,1,0 from scoped,bounds
   where watch_status='completed' and completed_at>=((this_month-interval '11 months') at time zone report_timezone) and completed_at<=current_timestamp
  union all
  select kind,to_char(watched_at at time zone report_timezone,'YYYY-MM'),0,0,1 from seen_scoped,bounds
   where watched_at>=((this_month-interval '11 months') at time zone report_timezone) and watched_at<=current_timestamp
 ), monthly as (
  select kind,month,sum(saved) as saved,sum(completed) as completed,sum(episodes) as episodes from events group by kind,month
 ), kinds(kind) as (values('all'::text),('movie'),('tv'),('anime'))
 select jsonb_build_object('generated_at',current_timestamp,'timezone',report_timezone,
  'collections',(select count(*) from public.library_collections where user_id=(select auth.uid())),
  'scopes',jsonb_object_agg(k.kind,jsonb_build_object(
   'total',coalesce(t.total,0),'rated',coalesce(t.rated,0),'average_rating',t.average_rating,'notes',coalesce(t.notes,0),
   'statuses',coalesce(t.statuses,'{"planned":0,"watching":0,"completed":0,"paused":0,"dropped":0}'::jsonb),
   'media',coalesce(t.media,'{"movie":0,"tv":0,"anime":0}'::jsonb),
   'episodes',(select count(*) from seen_scoped where kind=k.kind),
   'ratings',(select jsonb_agg(jsonb_build_object('rating',g.rating,'count',coalesce(rc.count,0)) order by g.rating) from generate_series(1,10) as g(rating) left join rating_counts rc on rc.kind=k.kind and rc.personal_rating=g.rating),
   'months',(select jsonb_agg(jsonb_build_object('month',m.month,'saved',coalesce(a.saved,0),'completed',coalesce(a.completed,0),'episodes',coalesce(a.episodes,0)) order by m.month) from months m left join monthly a on a.kind=k.kind and a.month=m.month),
   'top',coalesce(tt.titles,'[]'::jsonb)
  )))
 into result from kinds k left join totals t on t.kind=k.kind left join top_titles tt on tt.kind=k.kind;
 return result;
end $$;
revoke all on function public.personal_library_stats(text) from public,anon,authenticated,service_role;
grant execute on function public.personal_library_stats(text) to authenticated;
notify pgrst,'reload schema';
