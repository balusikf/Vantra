-- Run this WHOLE file on an administrative test connection. Synthetic identities
-- have no credentials. Every test section rolls back all its fixture changes.
begin;
insert into public.allowed_emails(email) values('tracking-a@vantra-audit.invalid'),('tracking-b@vantra-audit.invalid');
insert into auth.users(id,email) values ('a1111111-1111-4111-8111-111111111111','tracking-a@vantra-audit.invalid'),('b2222222-2222-4222-8222-222222222222','tracking-b@vantra-audit.invalid');
insert into public.watchlist(id,user_id,tmdb_id,media_type,title) values
('a1111111-2222-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111',2147483001,'tv','Synthetic A'),
('b2222222-2222-4222-8222-222222222222','b2222222-2222-4222-8222-222222222222',2147483001,'anime','Synthetic B');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $test$ declare c uuid; stamp timestamptz; n bigint; begin
 update public.watchlist set watch_status='completed',completed_at='2000-01-01' where id='a1111111-2222-4111-8111-111111111111' returning completed_at into stamp;
 if stamp<'2026-01-01' then raise exception 'Completion timestamp forgeable'; end if;
 update public.watchlist set personal_note='Keep review',completed_at='2000-01-01' where id='a1111111-2222-4111-8111-111111111111';
 if (select completed_at from public.watchlist where id='a1111111-2222-4111-8111-111111111111')<>stamp then raise exception 'Timestamp reset by unrelated edit'; end if;
 insert into public.library_collections(user_id,name) values('a1111111-1111-4111-8111-111111111111','Audit collection') returning id into c;
 insert into public.collection_items values(c,'a1111111-2222-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111');
 begin insert into public.collection_items values(c,'b2222222-2222-4222-8222-222222222222','a1111111-1111-4111-8111-111111111111'); raise exception 'Foreign title linked'; exception when insufficient_privilege then null; end;
 insert into public.watched_episodes(watchlist_id,user_id,season,episode) values('a1111111-2222-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111',1,1);
 begin insert into public.watched_episodes(watchlist_id,user_id,season,episode) values('b2222222-2222-4222-8222-222222222222','a1111111-1111-4111-8111-111111111111',0,1); raise exception 'Foreign episode marked'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.watchlist where user_id='b2222222-2222-4222-8222-222222222222') then raise exception 'Foreign row readable'; end if;
 update public.watchlist set watch_status='watching' where id='a1111111-2222-4111-8111-111111111111';
 if (select completed_at from public.watchlist where id='a1111111-2222-4111-8111-111111111111') is not null then raise exception 'Completion cutoff not cleared'; end if;
 delete from public.watchlist where id='a1111111-2222-4111-8111-111111111111';
 if exists(select 1 from public.collection_items) or exists(select 1 from public.watched_episodes) then raise exception 'Cascade cleanup failed'; end if;
 delete from public.library_collections where id=c;
end $test$;
reset role;
select true as tracking_isolation_and_cleanup_passed;
rollback;
begin;
insert into public.allowed_emails(email) values('tracking-a@vantra-audit.invalid'),('tracking-b@vantra-audit.invalid');
insert into auth.users(id,email) values('a1111111-1111-4111-8111-111111111111','tracking-a@vantra-audit.invalid'),('b2222222-2222-4222-8222-222222222222','tracking-b@vantra-audit.invalid');
insert into public.watchlist(id,user_id,tmdb_id,media_type,title,watch_status) values('a1111111-2222-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111',2147483001,'tv','Synthetic A','completed');
alter table public.watchlist disable trigger set_watch_completion;
update public.watchlist set completed_at='2026-01-01' where id='a1111111-2222-4111-8111-111111111111';
alter table public.watchlist enable trigger set_watch_completion;
insert into public.library_collections(id,user_id,name) values('a1111111-3333-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','Synthetic collection');
insert into public.collection_items values('a1111111-3333-4111-8111-111111111111','a1111111-2222-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111');
insert into public.watched_episodes(watchlist_id,user_id,season,episode) values('a1111111-2222-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111',1,1);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $test$ declare n bigint; begin
 select new_episodes into n from public.unseen_library_episodes('[
 {"watchlist_id":"a1111111-2222-4111-8111-111111111111","season":1,"episode":1,"released_at":"2026-02-01"},
 {"watchlist_id":"a1111111-2222-4111-8111-111111111111","season":1,"episode":2,"released_at":"2026-02-01"},
 {"watchlist_id":"a1111111-2222-4111-8111-111111111111","season":1,"episode":3,"released_at":"2025-12-31"},
 {"watchlist_id":"a1111111-2222-4111-8111-111111111111","season":1,"episode":4,"released_at":"2099-01-01"}]');
 if n<>1 then raise exception 'Seen/cutoff/future rules failed'; end if;
end $test$;
select set_config('request.jwt.claims','{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $test$ declare n integer; begin
 if exists(select 1 from public.library_collections) or exists(select 1 from public.collection_items) or exists(select 1 from public.watched_episodes) then raise exception 'Foreign tracking readable'; end if;
 delete from public.watched_episodes where watchlist_id='a1111111-2222-4111-8111-111111111111'; get diagnostics n=row_count; if n<>0 then raise exception 'Foreign seen deleted'; end if;
 delete from public.library_collections where id='a1111111-3333-4111-8111-111111111111'; get diagnostics n=row_count; if n<>0 then raise exception 'Foreign collection deleted'; end if;
 if exists(select 1 from public.unseen_library_episodes('[{"watchlist_id":"a1111111-2222-4111-8111-111111111111","season":1,"episode":2,"released_at":"2026-02-01"}]')) then raise exception 'RPC leaked foreign data'; end if;
end $test$;
reset role;
set local role anon;
do $test$ begin
 begin perform 1 from public.watched_episodes; raise exception 'Anonymous read allowed'; exception when insufficient_privilege then null; end;
 begin perform * from public.unseen_library_episodes('[]'); raise exception 'Anonymous RPC allowed'; exception when insufficient_privilege then null; end;
end $test$;
reset role;
rollback;
select true as tracking_rpc_and_cross_user_tests_passed;
