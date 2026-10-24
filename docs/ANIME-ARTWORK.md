# Anime artwork, 2026-10-22

Update: anime and TV now render episodes through the same `EpisodeRow` component and existing `.episodeList`/`.episode` styles. The former anime tile grid was removed. Both show a still on the left, episode number, title, actual runtime where known, synopsis where supplied, air date and the same play button/hover. Anime episode previews now preserve `runtime` and `overview` from the already fetched TMDB season, with missing/invalid values left null; no per-episode API requests or invented durations. Anime availability and MAL/AniList playback IDs remain unchanged. Validation: 61 tests, lint and production build passed.

Anime detail pages now use optional TMDB title logos and high-resolution landscape artwork. AniList remains the source of the anime identity, score, synopsis, MAL playback ID and episode availability. A TMDB mapping must never change the player or saved library identity.

## Mapping and source attribution

`src/data/anime-tmdb-map.json` is a server-only compact snapshot derived on 2026-10-22 from [Fribb/anime-lists](https://github.com/Fribb/anime-lists), `anime-list-full.json`. It contains 6,961 AniList → TMDB ID mappings (288,746 bytes), with a season only when the dataset explicitly supplies one. It contains factual IDs, no images or private data. It is imported exclusively by the server artwork module and is not shipped to the browser. The full remote list is not fetched at runtime. Future refreshes must preserve the upstream attribution and validate all numeric IDs and conflicts before replacing this snapshot.

Logos and backdrops are fetched from the existing configured TMDB API with an hour of Next fetch caching and the shared in-flight/cooldown guard. The artwork lookup appends only images, not credits, videos or recommendations. Only Animation titles with the mapped ID are accepted. Landscape artwork must have at least 1,280 source pixels in width; the UI can request the original image. A missing/failed match leaves the AniList banner and readable text title. The lookup is optional: a TMDB outage does not make the AniList title unavailable.

## Episode previews

Episode previews are loaded with one cached season request, not one API request per episode. Only explicit TV-season mappings are used. The AniList premiere must be within 14 days of the TMDB season premiere; a known episode count and contiguous numbering starting at 1 are required. If TMDB combines multiple cours, only the matching leading AniList count is returned. Later cours are not assigned an inferred offset. Missing or ambiguous matches remain without episode-specific screenshots.

The cards show a real episode name/still when available. A fallback title image is explicitly marked **Series artwork**, so it is not presented as an actual episode screenshot. The play URL still uses MAL + AniList identifiers exactly as before. Availability still follows AniList's schedule/status, not the presence of an image.

## Image quality

All anime list queries now request `coverImage.extraLarge` as well as `large`. AniList's `large` field can point to the medium image; the actual Frieren response confirmed that distinction. Poster `sizes` now reflects the two/three/five/six-column layouts more closely. Poster cards and detail backdrops request quality 85 (allowed alongside 75), and title logos use their original source rather than the 500-pixel variant. TMDB posters use a 500-pixel source rather than 342.

Higher-resolution images can transfer more image bytes. These images come from AniList/TMDB via the site's image optimizer, not from Supabase Storage. No claim is made that the image-quality upgrade reduces total website bandwidth. This improves available source quality; a low-quality upstream source cannot be restored by raising JPEG quality alone.

Official API references: [TMDB image basics](https://developer.themoviedb.org/docs/image-basics), [series images](https://developer.themoviedb.org/reference/tv-series-images), [season details](https://developer.themoviedb.org/reference/tv-season-details).
