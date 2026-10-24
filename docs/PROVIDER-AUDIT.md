# VANTRA provider audit — 21 October 2026

> Historical audit. The three new providers were integrated on 22 October 2026; see [current integration notes](PROVIDER-INTEGRATION.md).

## Result

VANTRA's provider selector changes the iframe correctly. There was a definite anime URL bug and two undocumented anime integrations. Those have been corrected. MultiEmbed remains the first/default movie and TV provider. No new provider has been added or declared reliable: successful continuous playback was not verified for a second provider during this audit.

## Existing providers

| Source | Published integration | Live observation | Action |
| --- | --- | --- | --- |
| MultiEmbed / SuperEmbed | TMDB or IMDb movies and TV episodes. Documentation does not list MAL anime IDs. | User reports it works. VANTRA's Furiosa movie route reached its correctly named player/ad screen. Continuous playback was not independently asserted. The documented VIP availability checks timed out from the command-line environment. | Keep the working movie/TV URLs and default order. Stop sending MAL IDs with the undocumented `mal=1` parameter. |
| VidLink | TMDB movie/TV; anime requires `/anime/{MALid}/{episode}/{subOrDub}`. | Furiosa, TMDB 786892, loaded a player shell directly and inside VANTRA, but remained at 0:00 after Play. The corrected anime route returned a blank page in the inspection environment. | Fix anime from `/anime/40748/1/7` to `/anime/40748/7/sub`. Keep documented movie/TV fallbacks; this correction is not a claim that upstream playback now works. |
| AutoEmbed | TMDB/IMDb movies and TV; its documentation does not list MAL anime. | Documented Fast X example (385687) and Furiosa inside VANTRA reached nested, correctly named players with durations, then the innermost player became blank before playback could be confirmed. Inspection interference cannot be excluded. | Keep the documented movie/TV URLs. Remove the invented `/anime/mal/...` option. Do not classify the service as globally down. |

Movies and series use TMDB IDs; the AniList anime tab uses MAL IDs for playback and retains AniList IDs for library/history. TMDB-listed animated series can still use MultiEmbed through their existing TV routes. No unverified cross-catalog mapping was introduced.

## Candidates checked, not integrated

- **VidRock:** its Furiosa player displayed a media failure at 0:00; logs contained its own `undefined.length` rejection and a failed metadata fetch. Not a verified backup.
- **Vidking:** its documented `www.vidking.net` embed could not resolve in the browser. The local A-record lookup also did not return an address for that host. This is a local observation, not a global uptime claim.
- **Vidly / former FilmU:** current documentation offers movie/TV/anime embeds, themes, subtitle controls and progress events. Its Furiosa page reached player controls and a duration, but subsequently logged an explicit inspection/devtools prohibition and blanked. No attempt was made to bypass that protection, and normal-browser playback remains unverified.

## Changes and validation

- URL construction lives in `src/lib/stream-providers.ts`, with per-media capabilities instead of assuming every provider supports every catalog.
- Movie/TV provider order and URLs remain unchanged; unsupported anime entries are no longer returned.
- Five new regressions cover movie defaults, exact TV season/episode and specials, the corrected anime episode/audio positions, unsupported MAL routes and invalid identifiers.
- 30 tests pass, lint passes without errors/warnings, and the production build passes using the previously documented Windows `UV_THREADPOOL_SIZE=1` setting.
- Authenticated API reads verified the movie primary, TV S2E3 URL parameters and anime episode 7. The production player menu and iframe confirmed `/anime/40748/7/sub` with only the documented anime source listed.
- No schema, RLS, credentials or security settings changed. No watchlist/history rows were deleted. Opening `/watch/movie/786892` exercised the existing history-on-open behavior and may add/update Furiosa in history. Anime layout checks omitted the AniList mapping and did not save a MAL ID as history.

## Next provider decision

A player page, HTTP 200 or iframe `load` event is not evidence of successful playback. A useful admission check is the same movie plus TV episode in the user's normal browser: playback starts, time advances, seeking works, subtitles are usable and the source behaves acceptably. Repeat before promoting a source to a default. Inspection-blocked candidates require a normal-browser check rather than an automation bypass.

Automatic failover should use documented, origin-validated player failure/progress messages where available. A blind timeout can interrupt slow but working streams. Embedded providers control their own streams, ads, quality and caption lists; a custom parent UI cannot repair upstream video availability.

## Primary references

- [SuperEmbed / MultiEmbed integration guide](https://superembed.stream/)
- [VidLink documentation](https://vidlink.pro/)
- [AutoEmbed documentation](https://autoembed.co/)
- [VidRock documentation](https://vidrock.net/)
- [Vidking documentation](https://www.vidking.net/)
- [Vidly documentation](https://vidly.pro/)
- [MDN iframe reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)
- [MDN postMessage security and message handling](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
