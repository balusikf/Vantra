# For you — personal discovery shelf

Added 2026-10-24 on the homepage between Continue watching and Trending now. Six poster cards reuse VANTRA's existing catalogue theme, hover behavior and title navigation. Each card explains its source with a More like link. Numeric private ratings and review notes remain in My Library; recommendation card scores are catalogue scores.

## Selection

The owner-scoped recommendation_seeds RPC chooses at most three distinct saved titles. Personal ratings of 7–10 qualify; unrated Watching/Completed titles provide additional context. Dropped titles and low personal ratings cannot become seeds. The top seed of each available media kind receives priority before additional seeds of the same kind. Seeds contain only catalogue ID, kind and title; numeric private ratings and notes do not leave the RPC result boundary.

TMDB title recommendations supply movies and series. AniList community recommendations supply anime. Only the catalogue ID is sent to those services. Candidate metadata is validated; adult, missing-poster, malformed-ID and future/unknown-release titles are removed. A bounded maximum of 54 candidates goes through the fresh owner-scoped recommendation_exclusions RPC. Every matching watchlist entry or watch-history entry is excluded, including completed, dropped and planned titles. The remaining pools are interleaved, deduplicated by catalogue kind + ID and capped at six.

Exclusions use exact catalogue identities: TMDB movie, TMDB TV and AniList anime IDs remain separate. An equivalent work stored separately in TMDB and AniList is not automatically resolved across catalogues. Empty preferences and exhausted matches have distinct honest empty states, with a library link. Catalogue outages show retry or partial-source behavior; general popular titles are not labelled as personal recommendations.

## Efficiency and security

- Fetch begins when the shelf approaches the viewport, not on a timer. No polling, profile writes, recommendation history table or extra database indexes.
- One application request performs one seed RPC, up to three public metadata requests and at most one exclusion RPC. No seeds: no external metadata calls or exclusion query.
- Public upstream metadata uses the existing 1-hour Next fetch cache, concurrent-request coalescing, provider cooldowns and deadlines. Private preference results never enter the shared public catalogue cache.
- Refresh and library-change events re-check personal state. Component state is keyed by user ID and aborted on unmount; changing accounts cannot reuse another account's shelf.
- The endpoint accepts no user selection or query parameters, authenticates via getUser(), limits per-account refreshes, and responds private/no-store. Both RPCs are SECURITY INVOKER with empty search_path and explicit auth.uid() filters; anon and PUBLIC lack EXECUTE. Existing RLS remains active.
- The whole request has a 20-second budget; upstream catalogue fetches retain their bounded timeouts. A failed exclusion check fails the feed rather than showing unverified candidates.

Applied SQL: docs/sql/for-you.sql is a single-use deployment reference, not a fabricated CLI migration. Existing user/library rows were not migrated or rewritten. Security advisor remained unchanged: the existing [Leaked Password Protection Disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) warning remains.

## End-to-end checks

Used the existing authenticated browser session and a previously unsaved test title, Game of Thrones (TMDB TV 1399). Before testing, owner-scoped SQL confirmed no watchlist/history entry for that title.

1. Added the title using the detail-page Watchlist button.
2. Marked episode S1E1 watched, reloaded and verified persistence.
3. Opened the homepage: Continue watching selected S1E2, The Kingsroad.
4. Saved a temporary 8/10 private review/note in My Library and verified it after reload.
5. Marked the remaining season watched, used Undo and verified only the original S1E1 mark remained.
6. Removed exactly the newly created test record through a guarded owner/ID/title/note match. The test rating/note and watched marks were removed by the existing cascade. Follow-up SQL confirmed zero watchlist, watched-mark and history test rows. Existing titles/reviews/marks were not changed.

This exercised the signed-in saving/review/manual-tracking/continuation flow. It did not submit a real password, create an account or play a third-party provider stream. Invalid-session HTTP checks are documented in AUDIT-2026-10-24.md.

## Recommendation checks

- Real owner seed: Cyberpunk: Edgerunners. Six valid recommendations rendered, with no saved seed returned as a candidate.
- SQL owner probes excluded saved TV 105248 and 1396 while preserving unrelated movie IDs and the removed test title. Synthetic non-owner received no seeds or exclusions. Anon EXECUTE is false for both functions.
- Anonymous API: 401/private-no-store; attempted userId query: 400.
- AniList's live GraphQL introspection confirmed the recommendation field/schema, and a public test returned Samurai Champloo, Trigun and Great Pretender for Cowboy Bebop.
- Desktop shelf: six columns. At 390 px: two columns, document width 384 px, no horizontal overflow. Screenshots saved in this chat's outputs directory.
- Unit tests cover seed bounds/private-field stripping, invalid/adult/future metadata, AniList identities, exclusions, source interleaving, duplicate removal and the six-card bound. Whole suite: 127 tests.

Official API references:
- https://developer.themoviedb.org/reference/movie-recommendations
- https://developer.themoviedb.org/reference/tv-series-recommendations
- https://graphql.anilist.co (live public schema queried because the documentation host returned 403)
