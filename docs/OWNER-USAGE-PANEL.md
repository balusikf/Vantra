# Private automatic Supabase capacity panel

The owner-only page at /profile/usage displays only automatically measured database and file-storage capacity. Manual monthly cards, billing-cycle dates, log readings, the editor and snapshot writes were removed on 2026-10-24.

## Data and refresh

The server authenticates the configured owner and calls owner_project_capacity(). One read-only RPC returns current Postgres database bytes, Storage object-metadata bytes and the SQL observation time. No snapshot-table read occurs on opening or refreshing the page.

The page loads measurements on open, then refreshes every five minutes while visible and when it regains focus/visibility, with a one-minute minimum between automatic attempts. Refresh capacity requests the same data. Each server process caches successful results for 60 seconds and coalesces concurrent loads. Failures retain the last successful client reading and its real timestamp with a visible warning. Missing/invalid Storage size metadata stays unavailable, never zero.

Database size includes indexes and system data, compared with the Free plan's 500 MB allowance. Stored-file capacity covers only VANTRA's project, compared with the organization-wide 1 GB allowance. These current measurements are distinct from billing-period averages and total disk usage including WAL. Other projects are excluded. Quotas reflect the configured Free plan and must be reviewed if the plan changes.

No recurring job, measurement history or tracking writes are added. Monthly traffic and other billing totals are available through the Supabase dashboard link; the app does not ask the owner to copy them.

## Security

The server page and both read-only API paths verify auth.getUser() and server-only VANTRA_OWNER_USER_ID before consulting the cache. Missing/invalid owner configuration fails closed. Non-owners receive page 404/API 403; unsigned API requests receive 401. HTTP responses are private/no-store. The former manual PUT handler has been removed (405).

Deployment reference: docs/sql/owner-project-capacity.sql, already applied. Do not rerun its CREATE statements. The public wrapper is SECURITY INVOKER; its narrowly scoped SECURITY DEFINER implementation is in its own unexposed schema, has a fixed owner check and empty search_path, and returns only aggregate sizes. PUBLIC and anon lack EXECUTE. Authenticated callers must pass the owner check. No service-role, Management token or dashboard credentials are used.

The legacy owner_usage_snapshots table and SQL deployment reference are inactive historical data. The app neither reads nor writes that table. No existing user data was deleted. Owner rotation requires coordinated updates to the environment and private capacity function; legacy table RLS is independent and unchanged.

## Verification

Capacity validation, unknown vs zero, owner gating, thresholds, cache expiry, concurrent reads and failed-load recovery have automated tests. PostgreSQL role probes verified owner access, non-owner denial and no anonymous EXECUTE when the RPC was deployed. UI removal is checked with lint, production build and authenticated desktop/mobile browser views. Charts and refresh animations respect reduced-motion preferences.

Sources:
- https://supabase.com/docs/guides/platform/database-size
- https://supabase.com/docs/guides/platform/manage-your-usage/storage-size
- https://supabase.com/docs/guides/platform/billing-on-supabase
