# Getting started

[Documentation](README.md) / Getting started

VANTRA is a private application, not an unrestricted public streaming deployment. Local development requires a configured Supabase project and an approved account.

## Requirements

| Requirement | Purpose |
| --- | --- |
| Node.js 24 and npm | Application runtime and native TypeScript tests |
| Supabase project | Authentication, private library data and avatar storage |
| TMDB API key | Server-side movie and series metadata |
| Network access | Public catalogue metadata and external playback sources |

AniList catalogue requests do not require a personal AniList token. External players have their own availability and browser requirements.

## Install

```sh
git clone https://github.com/balusikf/Vantra.git
cd Vantra
npm ci
cp .env.example .env.local
```

These commands work in Git Bash. In PowerShell, replace the last command with `Copy-Item .env.example .env.local`.

## Configure the environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public publishable key or legacy anon key |
| `TMDB_API_KEY` | Yes | Private server-side metadata key |
| `VANTRA_OWNER_USER_ID` | Optional | Server-only account UUID for the capacity panel |

Use your own values in `.env.local`. The owner setting must agree with the database capacity function's authorization. Without a valid owner configuration, that panel is unavailable.

Keep `.env.local` out of Git. A Supabase secret or service-role key must never be used in a `NEXT_PUBLIC_` variable. This application does not need a service-role key in its browser code.

## Prepare Supabase

The project expects the deployed VANTRA schema, including profiles, the account whitelist, saved titles, history, episode marks, collections, RPCs, RLS policies and the avatar bucket.

The files in [sql](sql) are historical deployment and verification references. They are **not a clean-project installer** and should not be executed together or rerun against the existing project. Review the applied schema and each script's notes before preparing another deployment.

The whitelist gates new registrations. Removing an address from it does not revoke an existing account's sessions. Account removal and session revocation require separate administration.

## Start the app

After filling in the environment and preparing the database:

```sh
npm run dev
```

Open [localhost:3000](http://localhost:3000) and sign in with an approved account. Restart the server after editing environment variables.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development with hot reload |
| `npm test` | Node test suite |
| `npm run lint` | ESLint checks |
| `npm run build` | Production build and TypeScript checks |
| `npm start` | Run the completed production build |

Production output uses `.next-production`; development uses `.next`. Run `npm run build` before `npm start`.

## Common problems

| Symptom | Check |
| --- | --- |
| `next` is not recognized | Run `npm ci` from the repository directory |
| Missing Supabase URL or key | Check `.env.local`, its location and the server restart |
| Registration is rejected | Confirm the account is approved in the configured project |
| Library or owner panel fails | Confirm the required deployed functions, grants and policies |
| A video does not load | Open playback help and try another source; see [Playback](PLAYBACK.md) |

For hosting, review the [security model](SECURITY.md). Process-local rate limits are not a hosting firewall or a global distributed quota.
