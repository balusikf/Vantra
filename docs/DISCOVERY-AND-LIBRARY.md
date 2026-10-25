# Discovery and library improvements

## Nook tasks

The home and navbar pickers share the same task switch. From my list reads only
the signed-in owner's Planned titles, preserving the existing small private
in-memory pool. Discover offers Mix it up, Trending now, New releases, Older picks
and Less mainstream, with movie/series/anime choices and an explicit genre filter.
Results show the release year and the category that supplied the suggestion.
Switching tasks unmounts/aborts the outgoing picker and clears its speech token.
The discovery controls do not affect From my list; Planned picks stay in the list.

Discover reads a public catalogue page only after a click and reuses the existing
hour-cached upstream requests, concurrency gates and five-minute client cache.
Mixed picks use shuffle cycles across all four categories. Anything also cycles
the compatible catalogues so one type cannot dominate by chance. Pages are sampled
beyond page one, bounded to ten per type/category/genre, with at most one retry
for a sparse or shorter catalogue. Fresh pool entries are reused before reading
another page. Recently suggested catalogue identities are excluded across modes
within the picker session; up to 360 identities, 32 pools and 64 shuffle bags are
retained in memory. This is broader discovery, not uniform sampling of all media.

Trending uses the actual TMDB weekly trending and AniList trending feeds. Recent
uses first-release dates within the past year; older means at least ten years
old. Less mainstream combines a minimum rating with a bounded number of votes
(TMDB) or list users (AniList), rather than sorting the global popularity chart.
Those audience measures differ between services and are not a guarantee that a
title is unknown. Genre and past-release checks also apply to returned results;
adult, future and unknown-date suggestions are excluded. For series, recent means
a newly launched title, not simply a new season of an older show.

The public APIs validate a fixed category, supported genre, media type and page
1-10 before authentication and the existing per-account quota. They accept no
custom upstream URL, query or sort. No extra Supabase tables, writes or library
reads are introduced. Catalogue pages supply genres directly, avoiding a detail
request when possible. Optional late enrichment cannot override a newer pat,
trick, selection or task. Nook keeps his genre reactions. No LLM is used.

## Catalogue filters

Movies/series use TMDB discover; anime uses AniList genre/year/minimum score.
Runtime filters apply to movies and TV episode lengths. Genres are mapped per
provider and type, never by interchanging IDs. Filtering applies to browsing;
title searches keep their existing search semantics. Explicit Apply avoids
requests on every form edit. Active filters are removable chips. Pagination
retains the entire filter set and the existing 18-item offset mapping. Changing
filters cancels an unfinished next page and invalidates stale responses.
Applied filters and sort are stored in the page URL, so refresh and returning
from a detail retain them. AniList's live `_greater` score filter includes its
boundary; an 8/10 minimum therefore sends 80, without subtracting one.

## Seasons and bulk marking

TV details use the animated, keyboard-operable season menu with search for long
lists, year/count information and private watched counts. Complete seasons get
a check badge. Summary counts are aggregated in Postgres and reused while
switching seasons, rather than transferring all watched rows for every season.

Mark season watched inserts only missing, released episode numbers in one
upsert, returning only newly inserted records. Undo removes that returned set,
preserving previous manual marks. Future/unknown-air-date episodes are excluded.
The title's explicit watch status is retained. Switching seasons hides the old
episode data until the new season is ready. Existing individual marking remains.

## Collections

The library has poster-collage collection cards. One owner-scoped RPC supplies
counts and up to four previews per collection, without fetching every member.
The arrange panel loads minimal members on demand, supports drag and keyboard
arrow buttons, and saves a complete order atomically. A stale membership list
is rejected rather than partially reordered. The arrange limit is 2,000 titles;
larger collections remain readable/filterable in the normal paginated library.
Selected collections use saved membership order with the normal 18-item pages.

A cover references a member of that same collection via a composite foreign
key. Removing that member clears the cover automatically. No image uploads,
copied files, external account data or extra storage buckets are needed.
New members sort after saved positions; owner RLS and column-scoped grants
protect both cover and order. See the applied SQL reference
`docs/sql/library-presentation.sql`; do not rerun its single-use DDL.

## People

Cast and creator links open /person/{TMDB_ID}. One cached request combines a
profile and movie/TV credits. Filmographies merge duplicate character/job roles
while retaining separate movie/TV IDs, with acting/crew/type filters and sort.
Only 18 posters initially render. Missing portraits, biography and roles have
honest fallbacks. These are public TMDB person IDs, not AniList staff IDs.

## Verification

Unit tests cover strict filter validation and pagination keys, catalogue/genre
mapping, released/missing episode selection, immutable reordering and credit
deduplication. Transactional database checks exercised order persistence, stale
order rejection, valid/invalid cover membership, automatic cover cleanup,
summary counts, cross-account reads/writes and anonymous privilege rejection.
Separate rollback checks confirm bulk undo preserves prior marks. UI checks
temporarily reordered/chose a cover in the existing collection, reopened it to
verify persistence, then restored its original order and automatic collage.
An existing unmarked season was marked (11 episodes) and undone in the UI;
aggregate database verification confirms the original 10 watched rows and four
saved titles remain. No test titles or collections were left in the account.

## Cosmetics follow-up

The separately agreed first set is Beanie, Round glasses and Bow tie. It is now
implemented through shared attachment geometry and browser-local account-scoped
preferences; see [Nook cosmetics](NOOK.md#cosmetics). Further accessories remain
for a later agreement. Emotional shape changes are retained without a favourite
shape setting.
