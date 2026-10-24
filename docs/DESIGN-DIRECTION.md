# VANTRA visual direction — revision 2

The approved design now lives at `/home`; `/preview` remains an alias. Movies, Series, Anime, and title details use the same shared theme. The Prime Video / Netflix references supplied by Filip are inspiration for a cinematic composition, rather than templates to reproduce.

## Shared rules

- One UI font: Geist Sans, now also the global body font. Use weights and scale for hierarchy, rather than introducing serif/italic fonts. The unused Geist Mono font load was removed. The project stays below the requested maximum of three font families.
- VANTRA uses a custom geometric SVG wordmark. The second letter keeps its barless Λ form; the other letters share its stroke width and geometry.
- Title logos are original TMDB image assets, preserving each film/series' own branding. They are not additional UI fonts. Four spotlight titles fetch image metadata on the server, using the existing one-hour TMDB cache. Prefer English, then language-neutral logos; a missing/failed logo falls back to an accessible text heading.
- Palette: background `#09090b`, surface `#161619`, raised surface `#232326`, text `#f5f5f7`, muted text `#a2a2ab`, accent `#e50914`. No gold, tan or brown UI accents. Content artwork retains its original colors.
- All catalog collections use the same portrait 2:3 poster cards. No landscape-card variant. Consistent radii, metadata, spacing and hover/focus behavior.
- A more opaque floating header provides navigation contrast. Spotlight artwork has no global opacity/brightness reduction; local left/bottom gradients keep text readable and the artwork visible.

## Motion already implemented

- Spotlight background crossfade with subtle scale, independent content fade/slide and original logo artwork.
- Optional nine-second rotation, explicit pause/resume, manual navigation pauses rotation, pause on hover/focus, no progression while the document is hidden.
- Section entrance on scroll; staggered poster entrances and filter updates.
- Poster lift, image zoom, border/overlay transitions; animated navigation underline and search panel.
- Native smooth horizontal scrolling. Reduced-motion preferences disable automatic rotation and spatial animation, including smooth rail scrolling.

## Shared pages and navigation

The approved tokens, SVG wordmark, navigation, poster cards, shelves, footer and states are shared under `src/components/vantra`. Catalogs support search, sorting, pagination, loading and recovery states. Movie/series/anime detail pages retain watchlist integration, original TMDB title artwork where available, trailers, metadata and episode navigation; movie/series details also retain cast and galleries. Anime keeps its AniList identity distinct from MAL playback IDs.

Soft page-entry transitions now use the App Router template and a lightweight route loading state. Normal links and back/forward behavior are preserved. Reduced-motion preferences remove the spatial entrance animation. This is an entry animation, not a coordinated exit/crossfade or an experimental router API. Library/profile and player styling are future work.

AniList still returned its temporary shutdown response during verification on 21 October 2026. Anime catalog/detail unavailable states were checked live; a successful live anime response could not be verified. No replacement provider or fabricated anime data was added.

No Supabase policies, data, accounts or migrations were changed by this visual revision.
