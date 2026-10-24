-- Owner-only current capacity; no billing credentials and no persistent writes.
-- Applied to VANTRA on 2026-10-24. Replace <OWNER_UUID> before another deployment.
begin;
create schema vantra_private_usage;
revoke all on schema vantra_private_usage from public, anon, authenticated;
grant usage on schema vantra_private_usage to authenticated;

-- Definer access is needed to aggregate ALL project storage despite object RLS.
-- The private function returns only two totals, never rows or user identities.
create function vantra_private_usage.project_capacity()
returns jsonb language plpgsql security definer
set search_path = '' set statement_timeout = '5s'
as $$
declare database_bytes bigint; storage_bytes bigint;
begin
  if auth.uid() is distinct from '<OWNER_UUID>'::uuid then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  select sum(pg_catalog.pg_database_size(d.datname))::bigint into database_bytes from pg_catalog.pg_database d;
  -- Incomplete/invalid object metadata must not silently become zero usage.
  select case when count(*) filter (where (o.metadata->>'size') is null or (o.metadata->>'size') !~ '^[0-9]{1,16}$') > 0 then null
    else coalesce(sum(case when (o.metadata->>'size') ~ '^[0-9]{1,16}$' then (o.metadata->>'size')::bigint end), 0)::bigint end
    into storage_bytes from storage.objects o;
  return pg_catalog.jsonb_build_object('databaseBytes', database_bytes, 'storageBytes', storage_bytes, 'observedAt', pg_catalog.statement_timestamp());
end;
$$;
revoke all on function vantra_private_usage.project_capacity() from public, anon, authenticated;
grant execute on function vantra_private_usage.project_capacity() to authenticated;

create function public.owner_project_capacity()
returns jsonb language sql security invoker set search_path = ''
as $$ select vantra_private_usage.project_capacity(); $$;
revoke all on function public.owner_project_capacity() from public, anon, authenticated;
grant execute on function public.owner_project_capacity() to authenticated;
commit;
