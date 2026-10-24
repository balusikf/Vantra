-- Run the WHOLE file on an administrative test connection.
-- Synthetic identities have no passwords or sessions. All fixtures roll back.
-- No real account data, Storage objects, policies or functions are changed.
begin;
insert into public.allowed_emails(email) values ('rpc-a@vantra-audit.invalid'), ('rpc-b@vantra-audit.invalid');
insert into auth.users(id,email) values
 ('a1111111-1111-4111-8111-111111111111','rpc-a@vantra-audit.invalid'),
 ('b2222222-2222-4222-8222-222222222222','rpc-b@vantra-audit.invalid');
insert into public.watchlist(id,user_id,tmdb_id,media_type,title,watch_status,personal_rating) values
 ('a1111111-2222-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111',2147483001,'tv','Synthetic A','completed',9),
 ('b2222222-2222-4222-8222-222222222222','b2222222-2222-4222-8222-222222222222',2147483002,'tv','Synthetic B','completed',8);
insert into public.library_collections(id,user_id,name) values
 ('a1111111-3333-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','Synthetic A'),
 ('b2222222-3333-4222-8222-222222222222','b2222222-2222-4222-8222-222222222222','Synthetic B');
insert into public.collection_items(collection_id,watchlist_id,user_id) values
 ('a1111111-3333-4111-8111-111111111111','a1111111-2222-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111'),
 ('b2222222-3333-4222-8222-222222222222','b2222222-2222-4222-8222-222222222222','b2222222-2222-4222-8222-222222222222');
insert into public.watched_episodes(watchlist_id,user_id,season,episode) values
 ('a1111111-2222-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111',1,1),
 ('b2222222-2222-4222-8222-222222222222','b2222222-2222-4222-8222-222222222222',1,2);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $test$
declare n integer; state jsonb; stats jsonb;
begin
 if (select count(*) from public.library_collections)<>1 or (select count(*) from public.collection_items)<>1 or (select count(*) from public.watched_episodes)<>1 then raise exception 'Tracking row isolation failed'; end if;
 if (select count(*) from public.collection_summaries())<>1 then raise exception 'Collection summary isolation failed'; end if;
 if exists(select 1 from public.episode_season_counts('b2222222-2222-4222-8222-222222222222')) then raise exception 'Foreign season counts leaked'; end if;
 state:=public.episode_tracking_state(2147483001,'tv',1,12);
 if state->'seen'<>'[1]'::jsonb then raise exception 'Own episode state failed'; end if;
 state:=public.episode_tracking_state(2147483002,'tv',1,12);
 if state->>'watchlistId' is not null or state->'seen'<>'[]'::jsonb then raise exception 'Foreign episode state leaked'; end if;
 stats:=public.personal_library_stats('UTC');
 if (stats#>>'{scopes,all,total}')::integer<>1 or (stats#>>'{scopes,all,episodes}')::integer<>1 then raise exception 'Personal statistics isolation failed'; end if;
 if jsonb_array_length(public.continue_watching_candidates()->'items')<>1 or (public.continue_watching_candidates()#>>'{items,0,id}')::integer<>2147483001 then raise exception 'Continue snapshot isolation failed'; end if;
 if jsonb_array_length(public.recommendation_seeds())<>1 or (public.recommendation_seeds()#>>'{0,id}')::integer<>2147483001 then raise exception 'Recommendation seed isolation failed'; end if;
 if exists(select 1 from public.recommendation_exclusions('[{"kind":"tv","id":2147483002}]')) then raise exception 'Foreign recommendation exclusion leaked'; end if;
 if not exists(select 1 from public.recommendation_exclusions('[{"kind":"tv","id":2147483001}]')) then raise exception 'Own recommendation exclusion failed'; end if;
 perform public.set_collection_order('a1111111-3333-4111-8111-111111111111',array['a1111111-2222-4111-8111-111111111111']::uuid[]);
 begin perform public.set_collection_order('b2222222-3333-4222-8222-222222222222',array['b2222222-2222-4222-8222-222222222222']::uuid[]); raise exception 'Foreign collection reordered'; exception when insufficient_privilege then null; end;
 begin perform public.owner_project_capacity(); raise exception 'Owner capacity leaked'; exception when insufficient_privilege then null; end;
 update public.collection_items set position=42 where collection_id='b2222222-3333-4222-8222-222222222222';
 get diagnostics n=row_count; if n<>0 then raise exception 'Foreign position changed'; end if;
 delete from public.watched_episodes where watchlist_id='b2222222-2222-4222-8222-222222222222';
 get diagnostics n=row_count; if n<>0 then raise exception 'Foreign episode deleted'; end if;
 begin insert into public.watched_episodes(watchlist_id,user_id,season,episode) values ('b2222222-2222-4222-8222-222222222222','a1111111-1111-4111-8111-111111111111',1,3); raise exception 'Foreign episode marked'; exception when insufficient_privilege then null; end;
 begin insert into public.collection_items(collection_id,watchlist_id,user_id) values ('b2222222-3333-4222-8222-222222222222','a1111111-2222-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111'); raise exception 'Foreign collection linked'; exception when insufficient_privilege then null; end;
end $test$;
reset role;
do $test$
declare f record; t text;
begin
 for f in select p.oid from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' loop
  if has_function_privilege('anon',f.oid,'EXECUTE') then raise exception 'Anonymous application RPC access'; end if;
 end loop;
 foreach t in array array['profiles','watchlist','watch_history','watched_episodes','library_collections','collection_items','allowed_emails','owner_usage_snapshots'] loop
  if has_table_privilege('anon','public.'||t,'TRUNCATE') or has_table_privilege('authenticated','public.'||t,'TRUNCATE') then raise exception 'TRUNCATE privilege leaked'; end if;
 end loop;
end $test$;
select true as private_rpc_and_tracking_isolation_passed;
rollback;
