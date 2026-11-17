# Security model and validation

[Documentation](README.md) / Security

VANTRA is intended for approved personal accounts. Its access controls protect private library data; they do not make third-party players or advertisements trustworthy.

## Account and data boundaries

| Boundary | Protection |
| --- | --- |
| Page access | Server-side account verification and session-cookie handling |
| API access | Handler-side verified account, strict parameters and bounded per-account requests |
| Private database rows | RLS plus explicit ownership filters and account-scoped RPCs |
| Mutations | Current-account verification, stable owner/row filters and stale-result guards |
| Shared metadata | Public catalogue data only; private notes, profiles and library results are excluded |
| Owner capacity | Server-only owner configuration and matching database authorization |
| Avatars | Validated raster uploads and owner-scoped storage operations |
| Browser APIs | Restricted device permissions and site response headers |

RLS and authenticated roles have separate purposes. An authenticated account still needs the appropriate row ownership and function authorization. Functions designed to respect caller permissions use `SECURITY INVOKER`; exceptional privileged capacity reads are isolated and explicitly owner-checked.

The registration whitelist blocks unapproved new registrations. It is not a session-revocation mechanism for accounts that already exist.

## Secrets and deployment

Only the public Supabase URL and public publishable or legacy anon key belong in browser configuration. TMDB credentials and the capacity-panel owner setting remain server-only. Never expose service-role or secret keys through `NEXT_PUBLIC_` variables.

Keep `.env.local`, sessions, database credentials and dashboard exports out of version control. Configure the deployed database policies and approved accounts before exposing the application. Review the [setup prerequisites](GETTING-STARTED.md) and the notes attached to each SQL reference.

In-memory rate limits, queues and cooldowns apply to a single running process. They are not a distributed quota or a replacement for hosting-level network protection.

## Validation snapshot: 17 November 2026

| Check | Recorded result |
| --- | --- |
| Automated application tests | 169 passed |
| ESLint | Passed |
| Production build and TypeScript | Passed with Next.js 16.4.6 |
| Production HTTP security checks | 38 passed |
| New anonymous episode-guide request | Rejected with 401 and private/no-store headers |
| Production dependency audit | No reported vulnerabilities |
| Full dependency audit | 14 high-severity entries in development tooling's dependency graph |

The remaining development entries trace to the unpatched [Picomatch repeated-extglob advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf). At this snapshot, the upstream advisory lists no patched release. A forced downgrade of the framework lint configuration was not used to conceal the finding.

These are dated checks, not a penetration test or a promise that future dependencies are vulnerability-free. Recheck with:

```sh
npm test
npm run lint
npm run build
npm audit --omit=dev
npm audit
```

## External playback

Players run on other origins. VANTRA cannot inspect every internal player action, remove all advertisements or guarantee that separately opened tabs are safe. Keep a reputable content blocker enabled and the browser updated. See [Playback](PLAYBACK.md).

Historical database and code audits are listed in the [documentation index](README.md). Their dates and scopes should be read before treating any old finding as current.
