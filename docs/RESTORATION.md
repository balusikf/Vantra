# Restoration baseline (21 October 2026)

## Local development

Use Node.js 24 LTS. Run `npm ci`, copy `.env.example` to `.env.local` and enter the existing project's public Supabase key, project URL and server-side TMDB key. Never use a Supabase secret or service-role key in a NEXT_PUBLIC variable. `.env.local` is ignored by Git.

Run `npm run dev` and open http://localhost:3000. The application is still local; it has not been deployed by this restoration work.

## Checks

- `npm run lint`: TypeScript/React lint rules, with no rules disabled for the restoration.
- `npm test`: regression coverage for anime identity mapping, strict provider parameters and safe avatar replacement. Requires Node's native TypeScript support (Node 24 recommended).
- `npm run build`: production compilation and prerendering. Production output uses `.next-production`; development output uses `.next`, avoiding collisions with the Windows development server.
- `npm audit --omit=dev`: production dependency advisories.

## Repairs

- Next.js and its ESLint configuration upgraded together to 16.4.2. Supabase dependencies pinned; compatible dependency fixes applied without `--force`.
- Browse and player useSearchParams hooks placed under Suspense boundaries.
- Navbar no longer reads window.location during server rendering, preventing mismatched active navigation.
- Unauthenticated API requests return JSON 401 rather than login HTML. Session-cookie updates survive redirects; protected responses are not publicly cached.
- Watchlist success is displayed only after a successful write; repeated clicks are blocked and failures are visible. Removed user-object debug logging.
- Anime history uses AniList IDs and metadata; provider MAL IDs remain separate. History failures no longer prevent loading player sources.
- Reload player actually remounts the iframe. Invalid media identifiers and episode parameters are rejected.
- Browse pagination advances only after success, distinguishes movie/TV identities and discards aborted initial requests.
- Explicit media/profile types replace untyped any values; the page title identifies VANTRA. Added an environment template without real credentials.
- AniList outages produce a recoverable availability message rather than treating an API error as an anime object or array.
- Profile mutations report failures; avatar uploads validate/compress images, use unique per-user paths and only clean up the previous file after the new profile URL was saved. An uncertain profile save keeps both files to avoid deleting a potentially committed avatar.
- A protected `/preview` route demonstrates the visual direction with real trending/movie/TV data, responsive navigation, filtering, search, animated hero switching and reduced-motion support. `/home` remains available.

## Open work

- During verification, AniList's public GraphQL endpoint returned 403 with its temporary stability shutdown message. This is separate from video-provider availability. No replacement catalog or new stream providers have been selected yet.
- Custom player, subtitle matching, watched-episode tracking, ratings, folders and usage dashboard remain future implementation work. The approved visual theme now covers home, catalogs and title details; profile/library are also overhauled; the player body remains for a later phase (its shared header/search/avatar are updated).
- The read-only database audit is documented in SUPABASE-AUDIT.md. The ten Advisor warnings are unchanged. The draft SUPABASE-HARDENING-REVIEW.sql addresses avatar ownership, bucket limits, trigger search_path/EXECUTE and unnecessary table grants; it has not been applied or tested against an isolated database. One ownerless existing Storage object needs separate review.
- Existing accounts, live watchlist writes, storage uploads and actual playback across providers have not all been exercised by automated tests. The identity regression tests do not prove a third-party stream is available.
- Development-only braces/fast-glob advisories remain in the ESLint dependency chain; npm's proposed forced downgrade is not appropriate. Recheck when an upstream patch is published.

Verified: production build, lint (zero errors/warnings), fourteen regression tests, anonymous HTTP access checks, authenticated home/catalog pagination/profile reads and the anime outage UI. Shared catalogs and title details were checked on desktop and at a 390px viewport, including movie search/sorting/pagination, mobile navigation, season changes, trailer embedding and gallery open/close. No authenticated user data was modified during the browser checks.

All changes are local. No database schema, policies, accounts, GitHub branches or deployment settings were changed.

Latest visual phase: dedicated library, profile/account overhaul, shared avatar, persistent navigation and animated search, five-minute public-metadata cache, and 18-title catalog/library batches. See THEME-OVERHAUL.md for validation and limits.

Provider audit follow-up: see PROVIDER-AUDIT.md for corrected anime routing, per-media source capabilities and the distinction between inspected player shells and verified playback. MultiEmbed remains the movie/TV default.
