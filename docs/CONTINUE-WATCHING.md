# Home continuation shelf

Continue watching sits before Trending on Home/Preview. Six recent titles are
selected from the signed-in owner's saved active/completed stories, episode
marks and last 24 history records. Planned titles with no marks/history are not
started automatically; paused/dropped titles and completed movies are excluded.
Active/history stories precede completed titles, then sort by recent activity.

The SECURITY INVOKER RPC has an empty search_path, no owner parameter, explicit
auth.uid filters on every private table and authenticated-only execution. It
returns one bounded snapshot, with per-season first gaps and compressed watched
ranges, rather than every episode row. No new table, tracking write, polling or
private localStorage/shared-cache entry is introduced. Owner changes unmount the
client; abandoned reads abort. The API verifies auth, rejects parameters, applies
a per-account quota and returns private/no-store responses.

TV selection follows the earliest unmarked regular episode, including holes.
Complete prefix seasons are skipped without loading their episodes. Season zero
is excluded from automatic progression but remains a valid explicit last-opened
resume hint. With no regular marks, the exact last-opened episode is resumed,
never advanced; opening an iframe is not evidence of completion. Unknown dates,
missing numbering, future releases and bounded scan exhaustion never yield a
play link. A completed title treats pre-completion releases as completed and
checks only later unmarked releases. To revisit older gaps, change its explicit
status to Watching or choose an episode from the detail page.

Anime uses season-zero marks and preserves the AniList catalogue ID separately
from its MAL playback ID. Confirmed schedules, next-airing metadata and finished
episode counts establish release eligibility. The current schedule and newest
50 confirmed airings are merged without mutating shared metadata. Incomplete
completed-airing history stays uncertain rather than claiming a caught-up state.
Movies require a known past release date. No exact playback timestamp is claimed;
position restoration belongs to whichever provider supports it.

Existing hour-cached public metadata/gates are reused; at most two title checks
run together, with three TV-season reads per title and a shared 20-second
deadline. Partial metadata failures produce an honest detail link and Refresh.
Cards use portrait artwork, reduced-motion transitions, semantic links, keyboard
focus rings and mobile stacking. Reading or clicking a card never marks an
episode watched; the existing playback history behavior is unchanged.

Unit verification covers sparse marks, boundaries, future/unknown dates,
completed titles, last-opened specials, scan limits, anime IDs/airings, movie
release guards and candidate validation. Transactional database fixtures verify
sparse range compression, pause exclusion, six-title bounds and account
isolation, then roll back. Anonymous execution is denied. Browser verification
uses the real account's completed Cyberpunk story and its ten existing marks;
no test title or mark remains in the account.
