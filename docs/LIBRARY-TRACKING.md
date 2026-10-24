# Library tracking, collections and new episodes

Implemented 2026-10-22. The existing VANTRA theme, private reviews, official scores and provider playback URLs are preserved. Export/import was intentionally excluded.

## Watching status

Each saved movie, series or anime has one status: **Plan to watch, Watching, Completed, On hold, Dropped**. Existing saved titles default to Plan to watch; no previous viewing is inferred. The library can filter by media type, status and collection together, with 18 titles per page and server-side filtering. Filtered counts do not overwrite the global Watchlist badge.

A database trigger sets `completed_at` when the status first changes to Completed. Editing a review, collection or another field leaves this cutoff unchanged. Moving away from Completed clears it; completing the title again starts a new cutoff. The client cannot backdate or silently reset the cutoff by directly updating that field.

## Manual watched episodes

The shared TV/anime episode row has an eye button; a check mark means watched, clicking it again undoes it. This does not depend on iframe events or providers. Marking an episode of an unsaved title first adds it to the library as Watching, then saves the mark. An already-saved title keeps its chosen status. Upcoming episodes cannot be marked through the UI; an existing mark can still be undone.

Marks are keyed by saved title + season + episode. TV includes the real season (including specials as season 0); anime uses season 0 with its AniList episode number. Provider playback continues using the original TMDB/MAL/AniList identities. Watched marks do not change the official score or create playback history.

Only the currently visible anime episode range/current TV season is loaded, with pagination for long lists. Mutations are serialized and failed requests show a retry instead of presenting an unsaved choice as saved. Automatically saving a title updates the top Watchlist button too.

## New episode badges

For visible, saved **Completed** series/anime, one private batch API request checks releases. An episode counts only if it was released **after `completed_at`**, has already aired and has no watched mark. Marked or older episodes are excluded by an RLS-protected, SECURITY INVOKER database comparison. Films are excluded. Checking does not mark anything watched or move a title out of Completed.

The checks run on library loading/selection changes, without cron jobs, polling, e-mails or push notifications. Public TMDB/AniList responses use the existing one-hour server cache. A batch contains at most 18 saved IDs; external work has three title workers, at most four recent anime pages/four relevant TV seasons per title, a shared time budget and a maximum of 2,048 comparison candidates. The endpoint uses its own per-account request limit. A provider failure or work limit produces an incomplete-check indication, never a fabricated zero-success claim. Normal library/review use remains available.

TV release metadata supplies dates rather than reliable episode release times: it is compared at UTC midnight, conservatively excluding same-day releases that cannot be proven later than completion. AniList supplies timestamps; schedule queries use the current hour bucket, so new badges can lag. This is a cached library hint, not a real-time alert service.

**Anime scope:** the badge follows the saved AniList entry. Anime seasons published as separate AniList titles are separate entries; this does not automatically subscribe to every sequel or combine different MAL playback IDs. TV seasons under one TMDB series ID are checked together.

## Private collections

Collections can be created, renamed, removed and used as library filters. A title can be in multiple collections. Names are trimmed, limited to 50 characters and unique per owner ignoring case. Assignment uses the actual full membership list even when the library is filtered to a single collection.

Removing a collection removes only its links; titles, statuses, private reviews and watched marks remain. Removing a saved title cascades its watched marks and collection links, preventing orphan rows. The collection itself remains. Deleting an account/profile also cleans up these owned records through foreign keys.

## Database and security

The applied Supabase migration is `library_tracking_collections_and_seen_episodes`; [SQL reference](sql/library-tracking.sql). New tables are `library_collections`, `collection_items`, `watched_episodes`, with RLS enabled, explicit authenticated grants, owner policies, indexed foreign keys and unique keys. Cross-owner membership/episode inserts are rejected even with a forged `user_id`. Anonymous access is denied. Internal completion-trigger code lives in the private schema with fixed search path and no client EXECUTE grant. The public comparison RPC is intentionally SECURITY INVOKER, validates candidate-list size and respects the caller's RLS.

No service-role key was added to the application. The new endpoint verifies its own authenticated user, selects only that user's completed titles and returns `private, no-store`. No videos are stored, no periodic tracking writes are added and no provider-specific controls are required.

## Verification

- **63 automated tests**, ESLint and production webpack build passed.
- Two synthetic passwordless identities in rollback-only SQL verified own CRUD, cross-owner denial, completion-cutoff preservation, unseen/old/future release rules, anonymous denial, RPC isolation and cascade cleanup. Tests ran before and after deployment; synthetic identities were rolled back.
- Browser verification covered marking and undoing an episode, persistence after navigation, automatic Watchlist synchronization, changing status, collection creation/rename/assignment and combined filters. Temporary UI test records were removed with exact-ID/owner/content guards.
- Security advisor has no new findings; the existing Free-plan leaked-password-protection warning remains. Performance advisor reports no findings.

Screenshots from UI verification use temporary example data and do not imply those titles or collections remain in the user's library.
