# Film collections

Movies with a valid TMDB `belongs_to_collection` reference link to
`/collection/[id]`. The new page uses the existing VANTRA theme, cinematic
artwork, poster cards, page transitions, reduced-motion handling and navigation.
It is separate from the user's custom library collections.

One hour-cached TMDB collection request supplies the overview, artwork and film
list. The authenticated `/api/tmdb?type=collection-detail&id=...` action accepts
only a positive 32-bit ID and no additional query options. It uses the existing
API authentication, per-account quota, upstream timeout/gate and private/no-store
HTTP responses. Public collection metadata may enter the shared catalogue cache;
private library status never does.

The list is deduplicated by movie ID and sorted by known release date, ascending.
Undated announcements appear last. Future films remain visible with their date;
missing dates are labelled as unannounced. This is release order, not fictional
chronology. A TMDB collection can omit spin-offs and other works in a broader
universe. The page displays 18 posters initially, with Show more for longer lists.
Malformed metadata and collections exceeding 200 raw parts are rejected rather
than presented as a complete, truncated collection.

One owner-scoped Supabase read retrieves only `tmdb_id,watch_status`, filtered by
the signed-in account, `media_type = movie` and the collection's unique movie IDs.
Existing RLS remains in force. No table, migration, history write or automatic
completion is added. The page never reads personal ratings or notes. A watched
badge requires an explicitly completed, released movie. Progress counts released
films only, and the next-film link follows the first uncompleted released film.
Opening a player or saving a planned title does not count as watching it.

Private progress is discarded on account changes, abandoned reads abort, and a
failed read shows an error with Refresh instead of zero watched. Refresh and
existing library-change events can reload that single bounded query. Empty
collections perform no library read. The public list remains available if a
private status read fails.

Verification includes release sorting, duplicate/invalid/adult metadata,
future/unknown dates, first-gap progression, strict API input, minimal owner
filters, movie/TV ID separation, cancellation and query failures. Live TMDB
checks confirmed Harry Potter (8 films), The Lord of the Rings (3) and Star Wars
(9), plus the movie-to-collection reference from movie 671 to collection 1241.

API references: [TMDB collection details](https://developer.themoviedb.org/reference/collection-details),
[TMDB movie details](https://developer.themoviedb.org/reference/movie-details).

## Connected film worlds

Selected collection pages include a "More from this world" section and a hero
shortcut. The initial verified groups are Wizarding World (Harry Potter and
Fantastic Beasts), Middle-earth (The Lord of the Rings and The Hobbit), Rocky &
Creed, and The Conjuring Universe (The Conjuring, Annabelle and The Nun).

TMDB collection details do not supply these broader relationships. The curated
graph in `src/data/film-worlds.ts` records collection IDs, relationship text and
primary sources. Connections are bidirectional, exclude the current collection,
and are limited to four related collections per request. Similar names, genres
and actors are never treated as evidence of a shared world. Unsupported
collections display no world section and trigger no extra request. This is a
selected set of connected film collections, not a complete fictional-universe
catalogue or a cross-franchise chronological watch order.

The authenticated `collection-world` action accepts only `type` and a bounded
`id`. Related cards load when the section approaches the viewport, using the
existing one-hour server metadata cache and five-minute public client cache.
Requests reuse collection details, including when navigating back to a sibling.
Each card shows the catalogue name, artwork, film count, known release years and
an explanation of the connection. Navigation does not prefetch related pages.
There are no extra Supabase queries, tables or writes for this section.

A failed sibling does not hide successful cards. If all siblings fail, the API
returns an unavailable response rather than caching an empty successful result;
the section offers Retry. Layout reserves space while loading, supports narrow
screens and respects reduced motion. Tests cover graph identity, reciprocal
links, bounded lookups, unknown collections, artwork/year fallbacks, partial
failures, wrong upstream identities and strict API input.

Relationship references: [Wizarding World films](https://www.harrypotter.com/discover/films),
[Middle-earth films](https://www.middleearth.com/films),
[Creed](https://www.mgm.com/movies/creed), and
[Warner Bros. Discovery on The Conjuring Universe](https://press.wbd.com/na/media-release/hbo-max/max-announces-development-drama-series-set-conjuring-universe).
