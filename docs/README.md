# VANTRA documentation

Implementation guides, operating limits and evidence behind the main [README](../README.md).

## Start here

| Guide | What it covers |
| --- | --- |
| [Getting started](GETTING-STARTED.md) | Requirements, environment, database prerequisites and commands |
| [Architecture](ARCHITECTURE.md) | Request paths, storage boundaries, data relationships and media identity |
| [Performance](PERFORMANCE.md) | Measured request reductions, chart data and Free plan implications |
| [Security](SECURITY.md) | Account isolation, secrets, playback boundaries and dated validation |
| [Playback and anime](PLAYBACK.md) | Recovery controls, subtitles, filler labels and iframe limits |
| [Roadmap](ROADMAP.md) | Planned work, including a dedicated mobile interaction pass |
| [Interface gallery](GALLERY.md) | Selected views of the application |

## Product guides

These guides include implementation notes and dated checks. The latest recorded validation snapshot is in [Security](SECURITY.md#validation-snapshot-17-november-2026).

| Area | Guides |
| --- | --- |
| Personal library | [Statuses, episodes and collections](LIBRARY-TRACKING.md), [private ratings and notes](LIBRARY-PRIVATE-REVIEWS.md) |
| Finding the next title | [Continue watching](CONTINUE-WATCHING.md), [For you](FOR-YOU.md), [discovery and filters](DISCOVERY-AND-LIBRARY.md) |
| Film worlds | [Collections and release order](FILM-COLLECTIONS.md) |
| Nook | [Interactions, discovery, reviews and cosmetics](NOOK.md) |
| Profile | [Personal statistics](PERSONAL-STATISTICS.md), [automatic owner capacity](OWNER-USAGE-PANEL.md) |
| Anime presentation | [Artwork mapping and identity rules](ANIME-ARTWORK.md) |

## Evidence and historical records

These documents describe their stated audit date. They are not live security reports or a statement that every historical finding remains open.

| Record | Purpose |
| --- | --- |
| [24 October measurements](audit-2026-10-24-measurements.json) | Anonymised client request starts used by the efficiency chart |
| [24 October audit](AUDIT-2026-10-24.md) | Measurement method, account read consolidation and database checks |
| [22 October API efficiency](API-EFFICIENCY-2026-10-22.md) | Earlier Auth, metadata-cache and outage-control comparisons |
| [25 October code audit](CODE-AUDIT-2026-10-25.md) | Regression fixes and their validation |
| [25 October mobile review](MOBILE-REVIEW-2026-10-25.md) | Responsive browser checks and their device-testing limits |
| [SQL references](sql) | Applied deployment records and verification queries, not a bootstrap bundle |

The source code and deployed policies determine current behavior. Performance percentages always belong to the specific scenario and measurement method stated in the guide.
