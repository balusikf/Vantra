-- Deployment reference: already applied to Vantra on 2026-10-22.
-- For a NEW project only: replace <OWNER_UUID> with the verified account ID.
-- Configure the same ID in the server-only VANTRA_OWNER_USER_ID variable.
-- No billing credentials, auth identities or usage readings are stored in this file.
begin;
create table public.owner_usage_snapshots (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 16384),
  updated_at timestamptz not null default now()
);
alter table public.owner_usage_snapshots enable row level security;
revoke all on public.owner_usage_snapshots from anon, authenticated;
grant select, insert, update on public.owner_usage_snapshots to authenticated;
create policy "Only the configured owner can read usage"
  on public.owner_usage_snapshots for select to authenticated
  using ((select auth.uid()) = owner_id and owner_id = '<OWNER_UUID>'::uuid);
create policy "Only the configured owner can insert usage"
  on public.owner_usage_snapshots for insert to authenticated
  with check ((select auth.uid()) = owner_id and owner_id = '<OWNER_UUID>'::uuid);
create policy "Only the configured owner can update usage"
  on public.owner_usage_snapshots for update to authenticated
  using ((select auth.uid()) = owner_id and owner_id = '<OWNER_UUID>'::uuid)
  with check ((select auth.uid()) = owner_id and owner_id = '<OWNER_UUID>'::uuid);
insert into public.owner_usage_snapshots (owner_id, data) values (
  '<OWNER_UUID>'::uuid,
  '{"periodStart":null,"periodEnd":null,"observedAt":null,"monthly":{},"capacity":{"databaseGb":null,"storageBytes":null,"observedAt":null}}'::jsonb
);
commit;
