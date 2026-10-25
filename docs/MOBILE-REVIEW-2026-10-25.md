# Narrow-screen review: 25 October 2026

Checked the local production build using browser viewport overrides. These are
responsive browser checks, not a test on physical iOS or Android hardware. No
user records or cosmetics were changed, and nothing was staged or committed.

## Issues fixed

- At 320 px, the navigation menu button extended beyond the header's right edge.
  The mobile header now uses bounded logo sizing, tighter spacing and 44 by 44 px
  targets for Nook, search, profile and navigation. The logo retains its design.
- The profile's sidebar imposed its intrinsic width on the single-column grid.
  At 320 px, forms became approximately 540 px wide and were clipped by the page,
  despite there being no obvious document scrollbar. The grid now uses bounded
  columns and a shrinkable sidebar. Profile panels are approximately 283 px wide
  at that viewport, with their inputs and actions inside the screen.
- Long actor names were clipped in the two-column mobile biography header.
  Narrower portrait sizing, a smaller heading at the smallest breakpoint and
  wrapping keep names such as Benedict Cumberbatch fully visible.
- Several search, catalogue and dialog controls had very small touch targets.
  Mobile navigation icons, modal close buttons, search actions and Nook discovery
  controls now provide larger targets. Mobile text entry in the adjusted forms
  uses 16 px text. Private rating controls have a 44 px minimum height.
- Horizontal scrollbars now receive the same compact height as vertical ones,
  preserving the existing dark/red styling on collection rails.

## Checks

| Area | Viewports and result |
| --- | --- |
| Home and mobile navigation | 320 and 390 px; header controls fit and the menu opens |
| Global search | 320 x 740 and 360 x 640; results and controls fit; shorter dialogs scroll |
| Nook panel, wardrobe and discovery | 320 and 360 px; no horizontal panel overflow; vertical scrolling remains available |
| Inline home Nook discovery | 390 px; category/type controls wrap within the section |
| Movie and anime catalogues | 320 px; 18 portrait cards, search and expanded filters fit |
| Series detail and season menu | 320 px; episode rows and season controls remain usable |
| Anime detail | 320 px; title, episode section and trailer stay within the content width |
| Film collection and connected-world card | 320 px; progress, posters and related card fit |
| Actor page | 320 px; long name no longer overflows its heading |
| Library, collection dialog, empty review editor | 320 px; forms, rating choices and actions fit without changing saved data |
| Profile and navbar breakpoints | 320, 360, 390, 560, 561, 760 and 768 px; no clipped profile panels or header controls |
| Personal statistics and owner usage | 320 px; cards and headings fit |
| Playback controls | 320 x 740 and landscape 844 x 390; no navbar; back/source controls fit |

The playback layout check used an invalid title ID deliberately. This keeps the
iframe empty, avoids contacting external playback sources and does not write
watch history. Its expected source error is not a playback compatibility test.

Poster shelves, private collection shelves, profile navigation and long charts
can scroll horizontally within their own bounded containers. That behavior is
intentional; whole-page width and individual clipped content were checked
separately. The login CSS was reviewed, but its anonymous screen was not opened
in the signed-in browser because the route correctly redirects to Home.

The production build, TypeScript, ESLint and the existing 154 automated tests
passed. Changes in this review are limited to CSS; account data, provider
settings and application behavior remain as before.
