-- Post-hardening verification. Run the WHOLE file as one transaction on an isolated
-- connection with administrative test access. Never execute selected statements.
-- All identities are synthetic, have no credentials and are rolled back at the end.
-- Storage policies are cloned onto a temporary fixture; real Storage objects are untouched.
begin;

-- Disposable identities exist only inside this transaction. No passwords, mail or sessions.
insert into public.allowed_emails(email) values ('audit-a@vantra-security-audit.invalid'),('audit-b@vantra-security-audit.invalid');
insert into auth.users(id,email) values
 ('a1111111-1111-4111-8111-111111111111','audit-a@vantra-security-audit.invalid'),
 ('b2222222-2222-4222-8222-222222222222','audit-b@vantra-security-audit.invalid');
do $test$ begin
 if (select count(*) from public.profiles where id in ('a1111111-1111-4111-8111-111111111111','b2222222-2222-4222-8222-222222222222'))<>2 then raise exception 'Profile trigger failed'; end if;
 begin
  insert into auth.users(id,email) values ('c3333333-3333-4333-8333-333333333333','blocked@vantra-security-audit.invalid');
  raise exception 'Whitelist failed';
 exception when raise_exception then
  if sqlerrm <> 'Email nie je na whiteliste' then raise; end if;
 end;
end $test$;
-- Storage metadata remains untouched: test exact deployed policy expressions on a temporary table.
create temporary table vantra_avatar_policy_fixture(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
alter table vantra_avatar_policy_fixture enable row level security;
grant select,insert,update,delete on vantra_avatar_policy_fixture to authenticated;
do $test$ declare p record; begin
 for p in select * from pg_policies where schemaname='storage' and tablename='objects' loop
  execute format('create policy %I on vantra_avatar_policy_fixture for %s to authenticated %s %s',
   p.policyname,p.cmd,case when p.qual is not null then 'using ('||p.qual||')' else '' end,
   case when p.with_check is not null then 'with check ('||p.with_check||')' else '' end);
 end loop;
end $test$;
insert into vantra_avatar_policy_fixture(bucket_id,name,owner_id) values
 ('avatars','b2222222-2222-4222-8222-222222222222/b.webp','b2222222-2222-4222-8222-222222222222'),
 ('avatars','a1111111-1111-4111-8111-111111111111.jpg','a1111111-1111-4111-8111-111111111111');
insert into public.watchlist(user_id,tmdb_id,media_type,title,personal_rating,personal_note)
values ('b2222222-2222-4222-8222-222222222222',2147483001,'tv','Audit B',9,'Only B');
insert into public.watch_history(user_id,tmdb_id,media_type,title)
values ('b2222222-2222-4222-8222-222222222222',2147483001,'tv','Audit B');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $test$ declare n integer; begin
 if (select count(*) from public.profiles where id in ('a1111111-1111-4111-8111-111111111111','b2222222-2222-4222-8222-222222222222'))<>1 then raise exception 'Profile read leaked'; end if;
 update public.profiles set display_name='Audit A' where id='a1111111-1111-4111-8111-111111111111';
 get diagnostics n=row_count; if n<>1 then raise exception 'Owner profile update failed'; end if;
 update public.profiles set display_name='Forbidden' where id='b2222222-2222-4222-8222-222222222222';
 get diagnostics n=row_count; if n<>0 then raise exception 'Foreign profile update succeeded'; end if;
 begin update public.profiles set email='changed@vantra-security-audit.invalid' where id='a1111111-1111-4111-8111-111111111111'; raise exception 'Profile email privilege leaked'; exception when insufficient_privilege then null; end;
 begin update public.profiles set display_name=repeat('x',61) where id='a1111111-1111-4111-8111-111111111111'; raise exception 'Name bound missing'; exception when check_violation then null; end;
 begin perform 1 from public.allowed_emails; raise exception 'Whitelist readable'; exception when insufficient_privilege then null; end;
 insert into public.watchlist(user_id,tmdb_id,media_type,title,personal_rating,personal_note)
 values ('a1111111-1111-4111-8111-111111111111',2147483001,'tv','Audit A',8,'Only A');
 if (select count(*) from public.watchlist where user_id in ('a1111111-1111-4111-8111-111111111111','b2222222-2222-4222-8222-222222222222'))<>1 then raise exception 'Review read leaked'; end if;
 update public.watchlist set personal_rating=7 where user_id='a1111111-1111-4111-8111-111111111111' and tmdb_id=2147483001;
 get diagnostics n=row_count; if n<>1 then raise exception 'Own review edit failed'; end if;
 update public.watchlist set personal_note='Forbidden' where user_id='b2222222-2222-4222-8222-222222222222';
 get diagnostics n=row_count; if n<>0 then raise exception 'Foreign review edit succeeded'; end if;
 delete from public.watchlist where user_id='b2222222-2222-4222-8222-222222222222';
 get diagnostics n=row_count; if n<>0 then raise exception 'Foreign watchlist delete succeeded'; end if;
 begin insert into public.watchlist(user_id,tmdb_id,media_type) values ('b2222222-2222-4222-8222-222222222222',2147483002,'movie'); raise exception 'Cross-user insert succeeded'; exception when insufficient_privilege then null; end;
 begin update public.watchlist set user_id='b2222222-2222-4222-8222-222222222222' where user_id='a1111111-1111-4111-8111-111111111111'; raise exception 'Ownership reassigned'; exception when insufficient_privilege then null; end;
 insert into public.watch_history(user_id,tmdb_id,media_type,title,season,episode) values ('a1111111-1111-4111-8111-111111111111',2147483001,'tv','Audit A',1,1);
 insert into public.watch_history(user_id,tmdb_id,media_type,title,season,episode) values ('a1111111-1111-4111-8111-111111111111',2147483001,'tv','Audit A',1,2)
 on conflict (user_id,tmdb_id,media_type) do update set episode=excluded.episode;
 if (select count(*) from public.watch_history where user_id in ('a1111111-1111-4111-8111-111111111111','b2222222-2222-4222-8222-222222222222'))<>1 then raise exception 'History read leaked'; end if;
 update public.watch_history set episode=99 where user_id='b2222222-2222-4222-8222-222222222222';
 get diagnostics n=row_count; if n<>0 then raise exception 'Foreign history edit succeeded'; end if;
 delete from public.watch_history where user_id='b2222222-2222-4222-8222-222222222222';
 get diagnostics n=row_count; if n<>0 then raise exception 'Foreign history delete succeeded'; end if;
 if exists(select 1 from public.owner_usage_snapshots) then raise exception 'Owner dashboard leaked'; end if;
 begin insert into public.owner_usage_snapshots(owner_id,data) values ('a1111111-1111-4111-8111-111111111111','{}'); raise exception 'Non-owner created dashboard access'; exception when insufficient_privilege then null; end;
 insert into vantra_avatar_policy_fixture(bucket_id,name,owner_id) values ('avatars','a1111111-1111-4111-8111-111111111111/new.webp','a1111111-1111-4111-8111-111111111111');
 if (select count(*) from vantra_avatar_policy_fixture)<>2 then raise exception 'Avatar read ownership failed'; end if;
 begin insert into vantra_avatar_policy_fixture(bucket_id,name,owner_id) values ('avatars','b2222222-2222-4222-8222-222222222222/hijack.webp','a1111111-1111-4111-8111-111111111111'); raise exception 'Foreign avatar path accepted'; exception when insufficient_privilege then null; end;
 begin insert into vantra_avatar_policy_fixture(bucket_id,name,owner_id) values ('avatars','a1111111-1111-4111-8111-111111111111/hijack.webp','b2222222-2222-4222-8222-222222222222'); raise exception 'Avatar owner spoof accepted'; exception when insufficient_privilege then null; end;
 update vantra_avatar_policy_fixture set metadata='{"test":true}' where name='a1111111-1111-4111-8111-111111111111/new.webp';
 get diagnostics n=row_count; if n<>1 then raise exception 'Own avatar update failed'; end if;
 update vantra_avatar_policy_fixture set metadata='{"test":true}' where owner_id='b2222222-2222-4222-8222-222222222222';
 get diagnostics n=row_count; if n<>0 then raise exception 'Foreign avatar update succeeded'; end if;
 begin update vantra_avatar_policy_fixture set owner_id='b2222222-2222-4222-8222-222222222222' where name='a1111111-1111-4111-8111-111111111111/new.webp'; raise exception 'Avatar reassignment accepted'; exception when insufficient_privilege then null; end;
 delete from vantra_avatar_policy_fixture where owner_id='b2222222-2222-4222-8222-222222222222';
 get diagnostics n=row_count; if n<>0 then raise exception 'Foreign avatar delete succeeded'; end if;
 delete from vantra_avatar_policy_fixture where owner_id='a1111111-1111-4111-8111-111111111111';
 get diagnostics n=row_count; if n<>2 then raise exception 'Own and legacy avatar cleanup failed'; end if;
 delete from public.watch_history where user_id='a1111111-1111-4111-8111-111111111111';
 get diagnostics n=row_count; if n<>1 then raise exception 'Own history delete failed'; end if;
 delete from public.watchlist where user_id='a1111111-1111-4111-8111-111111111111';
 get diagnostics n=row_count; if n<>1 then raise exception 'Own review delete failed'; end if;
end $test$;
select set_config('request.jwt.claims','{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $test$ begin
 if (select personal_note from public.watchlist where user_id='b2222222-2222-4222-8222-222222222222' and tmdb_id=2147483001)<>'Only B' then raise exception 'B review altered'; end if;
 if (select episode from public.watch_history where user_id='b2222222-2222-4222-8222-222222222222' and tmdb_id=2147483001)=99 then raise exception 'B history altered'; end if;
end $test$;
reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $test$ begin
 begin perform 1 from public.profiles; raise exception 'Anonymous profile access allowed'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.watchlist; raise exception 'Anonymous reviews access allowed'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.watch_history; raise exception 'Anonymous history access allowed'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.owner_usage_snapshots; raise exception 'Anonymous usage access allowed'; exception when insufficient_privilege then null; end;
end $test$;
reset role;
do $test$ declare f record; t text; begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' loop
  if has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE') then raise exception 'Private function executable'; end if;
 end loop;
 foreach t in array array['profiles','watchlist','watch_history','allowed_emails'] loop
  if has_table_privilege('anon','public.'||t,'TRUNCATE') or has_table_privilege('authenticated','public.'||t,'TRUNCATE') then raise exception 'Truncate privilege leaked'; end if;
 end loop;
end $test$;
select jsonb_build_object('signup_trigger',true,'whitelist_rejection',true,'two_user_profile_isolation',true,'private_review_crud',true,'history_upsert_and_delete',true,'owner_dashboard_isolation',true,'avatar_policy_clone',true,'anonymous_denial',true,'privilege_reduction',true) as verification;

rollback;
