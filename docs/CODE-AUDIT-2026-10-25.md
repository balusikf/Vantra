# Code audit: 25 October 2026

This review covers the current working tree, including the uncommitted Nook
discovery, film collection and connected-world changes. Earlier work was
preserved. Nothing was staged, committed or pushed.

## Scope

Reviewed application routes, authentication and API boundaries, library and
history mutations, episode tracking, metadata caches, upstream failure handling,
catalogue/search navigation, profile/avatar handling, Nook discovery and reviews,
film collections, and the repository's database policy/function definitions.
The automated suite also exercises continuation, recommendations, private
reviews, deletion verification, provider URL construction and personal stats.

This was a code review with targeted regression tests and local production
checks. It is not a proof that every execution path is bug-free, a new live
database configuration audit, or a penetration test of third-party players.
No schema, RLS policy or stored user record was changed for this audit.

## Fixes

### Account changes during watchlist and history operations

Previously the watchlist button read its state for one account but used the
freshly returned `getUser()` identity for the eventual mutation. Switching
accounts during that wait could apply the old action to the newly signed-in
account's matching title. A pending history operation had a similar problem.

Mutations now retain the account that initiated the action, verify that the
current authenticated identity still matches it, and reject abandoned work.
History receives the playback lifecycle's abort signal. Watchlist mutations
also avoid publishing old success, confirmation or error state into a new
selection. Owner filters and database RLS remain in place.

### Delayed episode title creation

Episode tracking checked its request generation only after writing episode
marks. A delayed watchlist insert or duplicate lookup could first publish an old
saved-title ID into a hook whose account or selection had changed.

The shared `ensureTrackedTitle` helper checks the selection before work and
after each asynchronous step. The hook checks again before retaining the ID or
starting the episode write. Watched marks, counts and undo availability are
exposed only for the selection that actually finished loading. Already-issued
database requests cannot be retroactively rolled back by these client guards;
they remain scoped to their original owner and title.

### Failed watchlist reads

A failed membership read previously looked like an unsaved title, and its Add
button became available. A duplicate insert could then report apparent success
without establishing the original state. Read failures now disable mutations
and offer a dedicated retry. A successful retry restores the normal controls.

### Authentication service outages

Several private API actions treated a Supabase Auth outage as a 401, or allowed
a thrown verification error to escape their controlled response handling.
Catalogue actions already distinguished this case.

The shared account boundary now covers catalogue/playback authorization,
continuation, recommendations, release checks, statistics and owner capacity.
Missing or rejected sessions return 401. Service failures and thrown verification
errors return a generic 503 with a 15-second Retry-After. Stale user data and
upstream diagnostics are not returned. Existing quotas, owner authorization and
private/no-store response headers are preserved.

### Small input and keyboard fixes

In a long season menu, Arrow Up from the season search skipped the final season.
It now focuses the last available option. Catalogue search inputs now enforce
the same 120-character limit as global search and the API.

## Verification

- 154 automated tests passed, including seven new regression cases for account
  changes, aborted verification, delayed title creation, duplicate lookups and
  authentication outages.
- ESLint and the Next.js production build, including TypeScript, passed.
- 38 HTTP security checks passed for anonymous denial, spoofed identity headers,
  input validation, private response headers, framing restrictions and unsupported
  methods.
- `npm audit` reported zero known vulnerabilities across installed dependencies.
- Secret scanning checked source/documentation, browser build output and reachable
  Git history. No configured private value or service-role key was found. The
  only tracked environment file is the placeholder `.env.example`.
- Browser checks confirmed watchlist status, the private library and statistics
  loaded without alerts; House of the Dragon switched from ten season-one
  episodes to eight season-two episodes with matching playback URLs; global
  search returned Dune results; Arrow Up from Friends' season search focused
  Season 10. No play, watched-mark, removal or review-save action was submitted.

## Existing limits

The app still embeds independently operated playback frames. Their availability,
advertisements and internal behavior are outside this repository's control.
Existing player permission restrictions and ad-blocker guidance remain. The
provider URL tests do not certify every external source's current playback.

Database policy references were reviewed as code. This run did not reapply SQL
or alter the deployed database. The vendored animation engine was checked through
its integration and existing behavior tests; every upstream animation algorithm
was not independently rederived.

Auth reference: [Supabase server-side client guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
