# Code and privacy review

Reviewed locally on 2026-10-24.

No exposed private credential or cross-account access was found in the checks below. This is a code review with targeted tests, not a guarantee against every vulnerability or a penetration test of the external services.

## Changes made

| Finding | Change |
|---|---|
| The avatar component could request any URL stored in the profile because it used an unoptimized image. | Avatar display now accepts only the signed-in account's raster image paths in the configured project's avatar bucket. Foreign hosts, other accounts' paths, credentials in URLs, unsafe schemes and SVG paths are rejected. Image requests use `no-referrer`. Existing valid legacy avatar filenames still work. |
| Server catalogue modules and the server Supabase factory lacked an explicit client-import guard. | Added `server-only` boundaries. Moved the public image URL constant to a client-safe module and made legacy component type imports explicit. The production build validates these boundaries. |
| The development toolchain contained a vulnerable transitive Zod version. | Updated the lockfile from 4.3.6 to compatible 4.6.7. The [advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) is patched in 4.6.6 and later. No runtime dependency was affected by this finding. |
| A deployment reference contained the actual capacity-panel owner UUID. | Replaced it with `<OWNER_UUID>`. An account UUID is not an authentication secret, but it need not be published. The live database guard and local environment configuration were preserved. |
| The README named individual playback sources. | Removed the provider table and playback-source names. Kept the general advertising, popup and content-blocker guidance. |

## Verification

- Scanned current source, configuration, documentation and public assets, all 38 generated browser text assets, and 76 reachable historical text blobs. No configured private TMDB key, recognized token literal, service-role JWT or private-key marker was found. Historical text blobs were limited to relevant extensions and 1 MB per blob; binary files were not credential-scanned.
- No environment files were tracked or found at environment-file paths in reachable Git history. The Git remote URL contained no embedded HTTP credentials. The Supabase browser key was checked separately to ensure it was a public key, not a service-role credential.
- Reviewed server environment access, API authentication and parameter validation, bounded public metadata caches, account changes, error handling, external links, plain-text review rendering, avatar replacement and iframe permissions. No application `eval`, arbitrary HTML rendering or credential logging was found. Private account/library responses are not placed in the shared catalogue cache.
- All eight application tables have RLS enabled. Inspected policies, table/column grants, function execution privileges and storage rules. Application RPCs use invoker rights; privileged internal functions are confined to private schemas with explicit authorization where applicable.
- Ran the existing [database security verification](sql/security-verification.sql) using two synthetic accounts. Own-profile updates, private-review CRUD, history upsert/deletion, whitelist enforcement, anonymous denial and avatar policy isolation passed. Storage policies were tested on a temporary clone; actual files were untouched.
- Ran [additional RPC and tracking tests](sql/security-rpc-verification.sql). Collections, episode marks, season counts, statistics, recommendation seeds/exclusions and continue-watching stayed scoped to the caller. Cross-account writes/reordering and non-owner capacity reads were denied. All fixture changes rolled back.
- All 27 local production HTTP checks passed: nine authenticated APIs rejected anonymous requests, protected pages redirected to login, forged identity/middleware headers and RSC prefetch requests did not bypass authentication, cross-origin probes received no permissive CORS header, invalid input returned 400, and the removed usage write method returned 405. Tested responses carried private/no-store and security headers without a configured private key or internal stack trace.
- The signed-in homepage loaded successfully after rebuilding. Its existing shared avatar loaded from the project bucket with `no-referrer`.
- `npm test`: 128 passed, zero failed. `npm run lint` passed. A clean `npm run build` passed; an initial stale Turbopack CSS-worker failure was resolved by regenerating build output. `npm audit`: zero reported vulnerabilities across production and development dependencies after the patch.

## Privacy boundaries and remaining limits

The Supabase project URL and publishable/anon key are intentionally visible in browser code. Access control comes from authentication, grants and RLS, not from hiding that public key. Private keys and the capacity-owner setting remain server-side.

The avatar bucket is public: anyone with a known avatar URL can retrieve that image. Its metadata listing and mutations are owner-scoped. Public buckets do not make profiles, email addresses, library notes or history public. Fully private avatars would require a separate migration to authenticated or signed image delivery. See [Supabase storage access control](https://supabase.com/docs/guides/storage/security/access-control).

External players, artwork hosts and other requested services can see network request information such as IP address. Player frames use `no-referrer` and deny unrelated device permissions, but VANTRA cannot inspect or remove advertising inside another origin. The iframe does not receive VANTRA's session cookies through its embed URL. Third-party advertising and popup behavior remain outside this review.

The CSP protects framing, base URLs, form targets and object embeds. It is not a strict script policy or an ad blocker. Per-account request limits and upstream gates are process-local; they are not a global denial-of-service defense for a future multi-instance public deployment.

Supabase's security advisor still reports disabled leaked-password protection. Its current [password-security documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) limits that feature to Pro and above. The project remains on Free; no plan or authentication setting was changed.

This review covers the local repository and connected database. It does not establish that an independently deployed site has the same code, environment, TLS configuration or access controls. No credentials were rotated, no real account records were changed, and the review did not publish the project.
