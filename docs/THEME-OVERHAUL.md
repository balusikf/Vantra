# Shared theme rollout — 21 October 2026

The accepted home design is now used by the actual `/home` route, Movies and Series catalogs, Anime catalog, and movie/series/anime detail pages. `/preview` remains accessible. The SVG wordmark and core palette/typography were preserved.

Shared components and styles live under `src/components/vantra`. The theme has one UI font, monochrome surfaces and one red accent, portrait poster cards, the same navigation/footer, hover and focus treatments, skeletons and reduced-motion support. The route template provides a soft entrance; it does not delay navigation with timers.

Catalog changes include scoped movie/series search, popular/top-rated browsing and pagination. Pagination keeps movie and series identities separate, removes duplicate titles and ignores stale requests after changing the collection. Top-rated requests now honor the requested page. The Anime catalog uses one paginated request with trending/popular/top-rated/search, rather than fetching all three lists on every visit.

Details retain original title logos, synopsis, genres, runtime/release metadata, watchlists, trailers, cast, stills and recommendations. Trailers load after explicit playback and have a separate YouTube link. Stills open in a native modal with Escape/focus handling. Series have season selection and correctly scoped episode links; unconfirmed/future episodes are unavailable. Anime retains separate AniList catalog / MAL playback identifiers, studio/trailer metadata and incremental episode display.

AniList remained temporarily disabled by the upstream service during live verification (HTTP 403, surfaced as application 503). The Anime catalog and detail error/retry designs work, but live anime success responses and playback could not be verified. Existing Supabase auth and row-level policies were not changed, and authenticated user data was not modified by UI verification.

Checks: production build, zero-error/zero-warning lint and 14 regression tests. Browser checks cover real movie results, top-rated sorting, 40 unique paginated cards, movie-scoped Dune search, Series navigation, season 2 episode URLs, trailer embedding, gallery open/close and Anime unavailable states. Responsive checks cover the same shared layouts on a 390px viewport. No new stream provider or custom player was introduced.


## Library, profile and navigation — 21 October 2026

- `/library` is a dedicated, protected collection with Watchlist and Watch history views, global title search, media filters, recent/title sorting, owner-scoped deletion and 18-row database pagination. History describes titles opened in the player rather than claiming verified viewing completion. Clearing history requires an explicit confirmation inside the app.
- `/profile` now uses the approved theme for identity, profile-photo controls, editable display name, read-only sign-in email and sign-out. Existing upload validation, compression, unique object paths and save-before-cleanup rules remain in place. Confirmed profile edits update the shared header immediately.
- A root-layout account provider loads the profile once per session mount and clears state on sign-out. A persistent header displays the actual avatar on home, catalogs, details, library, profile and player. The legacy player header defers to this common header.
- Shared search is an animated native modal with focus trapping/restoration, Escape/backdrop dismissal, Ctrl/Cmd+K and `/` shortcuts, scope filters and up to six real title suggestions. Requests debounce for 250ms, discard stale responses and cancel when no readers remain. Catalog/library input focus and suggestion transitions match the same theme.
- The header no longer fades or slides on every route change. Incoming content has a short, reduced-motion-aware transition; links use Next's prefetching, with bounded intent-based detail preloading. Public catalog metadata is cached in memory for five minutes (60 entries), including deduplicated concurrent requests and normalized parameter ordering. Personal account/library data never enters this cache.
- Catalog initial pages and subsequent requests now use 18 titles. TMDB's fixed upstream pages of 20 are mapped by offset across boundaries, rather than dropping titles 19–20. AniList requests 18 natively. Home rails display up to 18; poster skeletons reserve the same grid size. Upstream ordering can change between pages; existing identity-based deduplication remains in place.

Validation: production build, lint with no errors/warnings, 20 passing regression tests. New regressions exercise 18-title boundary mapping, final/empty pages, upstream errors, concurrent request deduplication, independent cancellation and retries after failure. Browser checks use the existing authenticated account, with no profile edits, uploads, saved-title deletion or history clearing performed. The account currently has an empty collection; empty states, queries, filters and search are checked against those real results. Populated library write flows still need a disposable account/data fixture for end-to-end mutation testing. AniList's upstream outage remains separate from the design changes.

Windows build note: static generation now uses one worker and one page at a time on Windows, reducing concurrent output-directory races. Other platforms retain Next's default build parallelism. A fresh production build completed with this setting.

## Playback navigation and compact artwork — 21 October 2026

The player now reserves the shared navigation's height before its source toolbar. Its iframe fills the remaining viewport rather than extending behind the navigation. Browser geometry checks confirm desktop navigation ends at 88px, toolbar starts at 108px and video starts at 160px; on a 390px phone, navigation ends at 76px, toolbar starts at 94px and the wrapped source toolbar leaves the video at 214–844px. The active navigation section follows movie/TV/anime playback routes.

Home, catalog and detail backdrops now start below the floating navigation, with an 18–20px gap. Banner heights are reduced while retaining the palette, font sizes, title artwork and bottom fades. TMDB backdrops use their original source through Next's responsive image optimization instead of a fixed 1280px source. Poster cards and their 18-title pagination are unchanged.

Watchlist removal (both detail toggle and library) and history clearing share an owner-filtered DELETE helper. The helper verifies that no matching rows remain before reporting success. Mutation errors, a silent zero-row/partial deletion and failed verification are covered using the real Supabase SDK with an isolated mocked REST transport; no real saved entries or history were deleted for testing. The live collection/history was read successfully. Playback layout QA used an existing supported legacy anime URL without an AniList mapping, so it did not add a history entry. Stream-provider playback availability was not asserted.

Validation: lint without errors/warnings, 25 passing regression tests and production build. Browser checks cover large desktop, tablet and 390px mobile, Home/detail/catalog artwork separation, retained 18-title grids, player control wrapping and search from the player.

On this Windows environment, parallel filesystem writes intermittently fail with `EPERM mkdir` during prerendering. The complete production build passed with `$env:UV_THREADPOOL_SIZE='1'; npm run build` in PowerShell. No application behavior or static rendering was disabled.


## Follow-up: artwork fade, quiet playback and sign-in � 21 October 2026

Artwork now fades in from the background at its top edge as well as at the bottom, retaining the existing header gap and image quality. Home/detail use a 96px top mask (72px on smaller screens); the catalog backdrop uses the same mask.

Watch routes hide shared navigation entirely. The video occupies the viewport, with floating Back and source-settings controls that fade after 2.8 seconds of inactivity. Moving to the top edge, tapping the reveal area or keyboard focus restores controls. The open source panel and keyboard-focused controls remain visible. Source selection and reload remain available inside the compact panel. Cross-origin iframe pointer/keyboard events are not observable by the parent; the top-edge reveal control handles returning from the video. The player also removes the reserved scrollbar gutter.

Navigation now renders only its existing underline: the hidden link-status marker pulses that underline during pending navigation instead of drawing a second line. Profile uses an animated circular ring; Library uses a subtle capsule and bookmark motion. Both expose their current-page state. The mobile Library entry also has no underline. Reduced-motion settings are respected.

The login page uses the shared VANTRA vector wordmark, Geist, the existing dark/red palette and a lightweight decorative SVG. Desktop has a cinematic brand panel; mobile concentrates on the form. The form has associated labels, standard password-manager autocomplete, native required/email validation, a password visibility toggle, loading feedback and accessible errors. It continues to use the existing Supabase password sign-in and Home redirect. No signup, password reset, database or policy changes were introduced.

Validation: production build with the documented Windows filesystem setting; lint without errors/warnings; the existing 25 regression tests pass. Browser QA covered authenticated Home/catalog navigation, Library/profile active styling, desktop/mobile player geometry, idle hiding and top-edge reveal, the source panel and Escape, plus production login at 1440px and 390px. Required fields, password visibility and a rejected sign-in using fabricated .invalid credentials were checked; no real password was handled or successful fresh sign-in asserted. Desktop/mobile login screenshots are saved in the task outputs.
