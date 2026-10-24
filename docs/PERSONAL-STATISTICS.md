# Private viewing journal

The profile links to `/profile/stats`: personal library counts, watch-status
distribution, movie/series/anime mix, rating histogram/average, six highest-rated
saved titles, marked-episode and note counts, collection count, and monthly
milestones for the last six or twelve calendar months. Type/range/measure changes
are local and reuse the same response. Collection count is explicitly account-wide.

Dates use the browser's IANA timezone, independently validated by the API and
Postgres. Monthly activity is saved-title dates, current completed-title dates
and manual episode-mark dates. It is not a playback log, episode runtime sum or
measured hours. Deleting marks/titles or changing status changes this current
snapshot; no shadow event history is retained. Private notes are counted but
their content is never returned. Personal ratings stay separate from public scores.

One read-only `personal_library_stats(text)` RPC aggregates all owner rows in
Postgres, not the first REST page. It returns four type scopes, fixed twelve-month
and ten-rating arrays, and at most six top titles per scope. Existing owner indexes
are reused. There are no new tables, event tracking, LLMs, polling, metadata
lookups or writes during viewing. The SQL reference is in `docs/sql/`.

The function is SECURITY INVOKER with an empty search_path, explicit auth.uid
owner predicates and existing RLS. Only authenticated can execute it; callers
cannot pass a user ID. The API validates parameters before queries, verifies the
user, applies a per-account token bucket, aborts abandoned RPC work and uses
private/no-store headers. Client memory belongs to the mounted account; identity
changes remount/discard it, and navigation cancels in-flight reads. No shared
public cache or localStorage contains statistics.

Charts have accessible values, focus/touch month selection and reduced-motion
support. Empty scopes retain real zeroes and an unrated average is a dash.
Unit coverage validates totals, ratings, month continuity, chart axes, timezone
validation and media ID routing. Transactional SQL verification used 1,001
temporary titles, tested month-boundary timezone behavior and cross-account
isolation, then rolled back every fixture. Anonymous execution was denied.
