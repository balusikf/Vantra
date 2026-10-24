# Provider integration - 22 October 2026

Added VidCore, VidNest and VidFast to the existing source selector.

Movie/TV order: MultiEmbed (unchanged default), VidCore, VidNest, VidFast, VidLink, AutoEmbed. All use TMDB IDs. VidCore and VidFast use VANTRA red and disable autoplay on load.

Anime order: VidNest using AniList ID, then VidLink using MAL ID. The watch route retains its MAL ID and supplies the separate `anilistId` mapping to the authenticated stream API. Legacy links without a mapping offer only VidLink rather than guessing an AniList ID. VidCore, VidFast, MultiEmbed and AutoEmbed have no documented AniList anime route here. Existing history catalog identities stay unchanged.

The iframe now allows encrypted media and retains no-referrer. Source changes remount the iframe. The larger source menu scrolls within short viewports.

## Validation

- All 33 tests and ESLint pass. Coverage includes separate MAL/AniList routing, legacy anime links, exact episodes and invalid IDs.
- Production compilation, TypeScript, prerendering and build trace collection pass with Webpack (`npm run build -- --webpack`, with Windows UV_THREADPOOL_SIZE=1).
- Turbopack failed to connect to its child Node worker in this Windows sandbox, including after network permission was granted. The build configuration was not changed to conceal this issue.
- Signed-in production browser checks on localhost:3000 confirm all six movie/TV entries, MultiEmbed as primary and correct iframe source replacement.
- VidCore and VidFast movie players identify Hope correctly. VidFast TV identifies House of the Dragon S2E3 with `/tv/94997/2/3`. Continuous playback on those sources was not confirmed in this integration check.
- Frieren MAL 52991 maps separately to AniList 154587: VidNest receives `/anime/154587/1/sub`. Playback advanced to 0:07 and seeking responded (0:25 observed afterward).
- The anime metadata service was unavailable during this check, so the existing history-save notice appeared. Loading and playing the source continued; metadata availability remains a separate issue.
- At 390 x 400 the source menu fits the viewport, scrolls and the bottom AutoEmbed option remains clickable. The viewport override was reset.

No health polling, automatic failover, schema changes or extra provider-status database writes were added. Availability varies by title; these observations do not establish universal reliability.

## Primary documentation

- https://vidcore.io/
- https://vidnest.fun/
- https://vidfast.vc/
