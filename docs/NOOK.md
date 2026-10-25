# Nook

VANTRA's optional-to-open companion, with a permanent home near the bottom of
the home page and a static launcher in the navbar. No episode notifications,
automatic popups, sound, LLM service or action tracking.

## Animation

The framework-free bloub engine is vendored at `src/vendor/bloub`, pinned to
`b4bb3c1b5f93c7b87a2e8d620f667c4093d97749`. See its LICENSE and UPSTREAM.md.
The unmodified MIT notice also ships as `public/licenses/bloub.txt`.
The React renderer preserves the SVG masks, depth ordering, particle effects,
eye movement and smooth state morphs. Nook uses the upstream pebble body,
attentive expression and VANTRA red palette.

- Clicking/tapping Nook pats him: immediate squash about his feet, soft rebound,
  and a happy expression. Keyboard activation also pats him.
- Double tapping/clicking Nook within 340ms celebrates with two little hops.
- There are no Pet or High five controls. The only separate interaction button
  is Do a trick: `egg`, `orbit`, `comet`, `burst`, `hexagon`, `swirl`, plus a jelly
  laugh and a levitating triangle. Separate shuffle bags also vary pats and joy.
- Choosing a title: `thinking`, then a happy or genre-related reaction.
- Idle uses the engine's blinking, gentle breathing and sway. Every 10–18 seconds
  of visible idle time it plays a quiet wink, stretch (`wide`), curious tilt,
  happy hops, sleepy slump, or occasional egg pose. Manual interactions postpone
  these beats and keep their speech intact.
- Personalities use 14 upstream expressions and all eight silhouettes: pebble,
  circle, squircle, capsule, triangle, hexagon, cloud and teardrop. Additional
  body gestures are layered around the complete SVG, keeping its mask/depth order.
  Fear is a brief damped wiggle or low peek; tiredness holds a slump then eases
  back. Laughter ripples the body, music sways, fantasy floats, mysteries scan,
  action stands taller, and thoughtful stories get a little nod. Rapid
  interruptions blend from the current body pose. Emotions settle after 7 seconds.
- Eyes follow the pointer across the entire page, with smoothed, bounded angles
  and correct vertical direction. Listeners are detached with the animation loop.
- The pet hit area is contained in its stage, decorative SVGs ignore hit tests,
  and the separate interaction buttons have at least 44px-high targets.
- The home card uses `overflow: clip`: decorative rings cannot create a hidden
  scroll area that moves its content while focusing/clicking controls.

The engine is loaded on demand, without Vue or export encoders. RAF stops when
the avatar leaves the viewport, the tab becomes hidden, or the companion is
paused. Opening the panel pauses the homepage companion. Reduced motion uses
static representative poses. Closing a panel releases its animation and read
request; changing identity/routes discards it immediately. `/watch/**`, `/login`
and `/` never mount the panel; watch pages have no homepage companion or navbar.

## Tonight picker

The shared picker now has explicit From my list and Discover task modes. The
Planned-list behavior below belongs to From my list. Varied catalogue discovery
and its bounded reads are described in [Discovery and library](DISCOVERY-AND-LIBRARY.md).

Only clicking Pick loads the signed-in owner's `watch_status = planned` rows.
The read selects only `tmdb_id,media_type,title,poster_path`, explicitly filters
the owner in addition to existing RLS, and pages in stable ID order by 500 rows.
A 12-second read deadline and close/navigation abort prevent abandoned work.
The same picker is used inline on the homepage and in the navbar panel. Homepage
selection/results stay in place and never open the panel. The private pool lives
only in that picker's memory. Type filters and subsequent picks reuse it without
new queries; after one minute the next requested pick refreshes it. There is no
polling, database write or new table. Closing/reopening the panel or leaving home
discards its pool; no account data is placed in localStorage,
the shared public metadata cache, or an external service.

Picks cover all planned titles, avoid repeats until a type's pool is exhausted,
and avoid an immediate repeat when there is another candidate. The UI handles
empty lists, empty type filters, errors and missing artwork. Links open the
correct movie/TV/AniList detail page; picking does not start playback or change
watch status.

An optional genre lookup reuses the existing public detail cache. On a cache
miss it requests that selected title's normal TMDB/AniList detail endpoint, with
a 4.5-second deadline. It never delays or fails a pick, polls, or stores library
data in the public cache. Sixteen genre groups (including the unknown-genre
fallback) each have three coordinated speech/expression/shape/motion variants.
Specific genres win over broad ones independently of API order. Horror and
thrillers are nervous; mysteries investigate; comedy laughs; family stories
cheer; romance blushes; music dances; sci-fi explores; fantasy floats; action
readies a tiny hero; sports cheer; slice of life relaxes; drama offers emotional
support; documentary/history react with curiosity. Bubbles describe the known
genre rather than claiming Nook has watched or reviewed the title.

Each companion keeps private shuffle bags: every variant is used before a cycle
restarts, with no immediate repeat at cycle boundaries. There is no persistence
or network request for interactions or idle motions. Speech and visuals update
as one conversation state; a selection token prevents a late metadata result
from overriding either part after a subsequent pat, trick or new selection.

## Verification

Automated tests cover owner/status filters, page boundaries, aborts, selection
cycles, type/ID separation, artwork hosts, excluded routes, global gaze geometry,
visible-time idle scheduling, manual-interaction priority and overlapping
dialog scroll locks. Manual browser checks cover the launcher, speech, provided
animation interactions, empty library, Escape/focus restoration, search handoff,
homepage layout and complete absence on playback. No account fixtures needed.
Personality tests additionally cover both API genre formats, priority in mixed
genres, squash/rebound, two distinct hops, fear decay, sleepy hold/recovery,
finite bounded transforms and interruption continuity. Anime catalog decorations
are fallback-only: a loaded banner never has the katakana/rings painted over it.
Additional tests cover genre specificity, shuffle cycles, silhouette variety,
distinct new body gestures and atomic speech/animation priority on late results.

## Detail review corner

Movie, TV and anime detail pages seat a small Nook beneath the synopsis/genres,
within the existing left overview column. The trailer column is unchanged. The
initial bubble reacts to the title's genre. Clicking What do viewers think?
explicitly reveals community previews (which may contain spoilers) and loads
one bounded batch: the first TMDB review page, or ten helpful AniList summaries.
No review request is made on initial render, idle, pat, or scrolling. The avatar
itself loads near the viewport. Another perspective shuffles the same batch,
exhausting it before repeating. Hide reviews aborts an unfinished read.

The existing authenticated, rate-limited catalog routes, upstream coalescing /
one-hour fetch cache and five-minute public client cache handle these reads.
No Supabase tables, writes, polling, review scraping or LLM calls are added.
Unmount/title changes abort the reader; each title has an isolated component.
Empty/unavailable reviews keep the genre companion, with an explicit empty/error
message and retry for errors. Source links are reconstructed from validated IDs;
HTML/markup is flattened to plain React text, previews are capped at 180
characters plus ellipsis, and server batches at ten. AniList returns only its
short public summary, never the full review body or private review.

Each preview credits its author and source and links to the complete original.
Five fractional stars represent the author's own rating, alongside its original
number/scale: TMDB /10, AniList /100. AniList `score` is the media score;
`rating` is review helpfulness and must never drive these stars. Missing/invalid
ratings stay unknown; zero is a real rating. Neither the title's aggregate score
nor the owner's private library rating is involved.

Nook mirrors that author's rating: 4.5–5 stars excited hops, 3.5–4.5 happy nod,
2.5–3.5 mixed/confused tilt, 1.5–2.5 sad droop, below 1.5 angry grumble. These
are reactions to the score rather than generated summaries/sentiment analysis.
The face persists while that review is displayed; random idle emotions are
disabled here. Tapping the avatar gives squash feedback while preserving the
author's mood. Gaze, offscreen/hidden pause and reduced-motion support are shared
with the main Nook renderer, and opening the navbar panel pauses this avatar.

## Cosmetics

Style Nook opens a small animated wardrobe on the home companion and navbar
panel. Beanie, Round glasses and Bow tie are independent toggles; all eight
combinations, including none, are supported. Remove all restores the bare Nook.
The shared provider updates the static navbar icon, lazy-loading placeholders,
home companion, open panel and detail review companion together.

The choice is versioned, browser-local and account-scoped (with a separate guest
choice), with storage-event synchronization across tabs. No account library data,
network request, database read/write, image download or polling is introduced.
Disabled/full browser storage degrades to in-memory selection for the visit.
Preferences are not synchronized to other browsers/devices. Server rendering
uses the bare icon, and hydration restores the current account's stored outfit.

SVG accessories are code-native. The small documented engine adapter exposes
the sampled, interpolated silhouette and pre-blink eye tangent matrices. Glasses
therefore follow real gaze, depth and fitted eye centers without squashing with
eyelids or copying expression-specific eye tilts. Beanie and bow follow current
body morph, rotation and squash. All use the existing outer gesture/breathing
groups, mask/clip depth and visible-time clock, with no second animation loop.

Thinking dots, alert/exclaim glyphs, sleep dot, burst and comet hide the complete
outfit for their duration. Face visibility/depth also hides it when the face is
absent or turns away, including return transitions. Blinking alone never hides
accessories. The wardrobe honors reduced motion and keyboard focus; decoration
never receives pointer events. No Nook is mounted on playback.

Regression tests sample every upstream animation across all eight silhouettes,
all expressions with opposing gazes, interrupted morphs, blink/head separation,
hidden states, bounded geometry, version parsing, account isolation, tab events
and storage failure. Browser verification covers outfit combinations, home,
panel, navbar, detail companion, refresh persistence and reduced-width layout.
