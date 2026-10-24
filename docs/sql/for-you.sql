-- One-time deployment reference, VANTRA 2026-10-24. No new tables or tracking writes.
begin;
create function public.recommendation_seeds()
returns jsonb language sql stable security invoker set search_path='' as $$
with ranked as (
 select w.tmdb_id as id,w.media_type as kind,w.title,w.personal_rating,w.added_at,
 row_number() over(partition by w.media_type order by w.personal_rating desc nulls last,w.added_at desc,w.id) as position
 from public.watchlist w where w.user_id=(select auth.uid()) and w.watch_status<>'dropped'
 and (w.personal_rating>=7 or (w.personal_rating is null and w.watch_status in ('watching','completed')))
), picked as (
 select * from ranked order by position,personal_rating desc nulls last,added_at desc,id,kind limit 3
)
select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'title',title) order by position,personal_rating desc nulls last,added_at desc,id,kind),'[]'::jsonb) from picked;
$$;
revoke all on function public.recommendation_seeds() from public,anon,authenticated,service_role;
grant execute on function public.recommendation_seeds() to authenticated;

create function public.recommendation_exclusions(candidates jsonb)
returns table(kind text,id integer) language plpgsql stable security invoker set search_path='' as $$
begin
 if (select auth.uid()) is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if candidates is null or jsonb_typeof(candidates)<>'array' or jsonb_array_length(candidates)>60 then raise exception 'Invalid recommendations' using errcode='22023'; end if;
 if exists(select 1 from jsonb_to_recordset(candidates) as c(kind text,id integer) where c.kind is null or c.kind not in ('movie','tv','anime') or c.id is null or c.id<1) then raise exception 'Invalid recommendations' using errcode='22023'; end if;
 return query select distinct c.kind,c.id from jsonb_to_recordset(candidates) as c(kind text,id integer)
 where exists(select 1 from public.watchlist w where w.user_id=(select auth.uid()) and w.media_type=c.kind and w.tmdb_id=c.id)
 or exists(select 1 from public.watch_history h where h.user_id=(select auth.uid()) and h.media_type=c.kind and h.tmdb_id=c.id);
end;
$$;
revoke all on function public.recommendation_exclusions(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.recommendation_exclusions(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
