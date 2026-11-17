# Roadmap

[Documentation](README.md) / Roadmap

This page records agreed directions. Items marked planned are not implemented features or delivery commitments.

## Planned: a dedicated mobile interaction pass

Requested on 17 November 2026. The existing responsive layout remains, but a smaller screen deserves interaction choices designed around touch rather than only a narrower desktop layout.

| Area | Direction | Status |
| --- | --- | --- |
| Buttons and icon actions | Review every interactive target; aim for comfortable 48-52 px primary targets where practical, with room between adjacent actions | Planned |
| Navigation | Review thumb reach, menu density and access to search, library and profile | Planned |
| Filters and menus | Explore touch-friendly sheets, clearer grouping and larger options | Planned |
| Episode rows | Give play, watched marks, ranges and season selection more space without hiding their meaning | Planned |
| Library and dialogs | Keep ratings, notes, collection actions and confirmation controls comfortable with an on-screen keyboard | Planned |
| Nook | Preserve a clear hit area and separate nearby controls while retaining the companion's character | Planned |
| Visual identity | Keep VANTRA's typography, wordmark, dark surfaces and red accent | Agreed constraint |

This pass should include portrait and landscape layouts, short screens, safe-area spacing, long titles, keyboard visibility, focus order and reduced-motion behavior. Browser viewport checks should be followed by checks on physical Android and iOS devices where available.

Some controls already have 44 px targets. That existing work is a starting point, not a claim that every button has completed the planned review.

## Deferred or exploratory

| Idea | Dependency |
| --- | --- |
| More Nook cosmetics | Agree the next set and verify attachments during every shape and animation |
| Universal custom subtitles or player controls | A supported external API or a compatible direct stream; iframe embedding alone is insufficient |
| Broader playback coverage | Verify title/episode identity, browser compatibility and source availability |

Security maintenance and regression checks remain ongoing work. Documentation should distinguish proposals, implemented behavior and dated audit results.
