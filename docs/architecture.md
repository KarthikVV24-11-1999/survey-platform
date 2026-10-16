# Architecture

A Next.js app on Vercel talking to Postgres (Neon), with images in Cloudflare R2. OpenAI handles moderation, Turnstile handles bot checks, and Resend is used for email sign-in when it's set up.

All of the actual logic is in `src/server`. Pages, server actions (`src/app/actions`) and route handlers are thin layers on top, and each of them checks the session itself.

## Layout

| Path | |
|---|---|
| `src/server/env.ts` | Env validation |
| `src/server/db` | Drizzle client and schema |
| `src/server/auth` | Better Auth setup, session helpers and permission rules |
| `src/server/polls` | Creating polls, voting, moderation actions and queries |
| `src/server/moderation` | Rules, the OpenAI client and the publish/review/reject decision |
| `src/server/media` | Image processing, storage and uploads |
| `src/server/admin` | User, settings and word list management |
| `src/server/security` | Rate limiting, Turnstile, client IP and hashing |
| `src/lib` | Code shared with the browser (validation, embeds, formatting) |
| `src/proxy.ts` | Per-request CSP |

## Data

- `users`, `sessions`, `accounts`, `verifications`: Better Auth, plus role, trust level and ban fields on users
- `polls`, `poll_options`, `poll_attachments`: the polls themselves, with vote counts kept on the options
- `ballots`, `ballot_choices`: one ballot per voter per poll (unique on `poll_id, voter_key`)
- `media`: uploaded images, with their moderation result
- `reports`, `moderation_events`, `audit_log`: reports, moderation decisions and staff actions
- `moderation_terms`, `site_settings`: admin word/domain lists and settings
- `rate_limits`, `auth_rate_limits`: rate limit counters

Migrations live in `drizzle/` and are generated with `npm run db:generate`. CI fails if the schema and migrations don't match.

## Main flows

**Creating a poll:** check the user can post, validate the input and Turnstile token, apply rate limits, check any images belong to the user, run moderation, then write everything in one transaction.

**Voting:** validate, check Turnstile for anonymous voters, then in one transaction lock the poll row, make sure it's still open, upsert the ballot and update the counts.

**Uploading an image:** check the origin and session, re-encode the image, run it through moderation, then store it in R2. Uploads that never get attached to a poll are deleted by the daily cron.

**Moderating:** status changes only apply if the poll is still in the expected state, so two moderators can't overwrite each other. Each one updates image visibility, closes the open reports and writes to the audit log.

## Rendering

Pages render per request so each response gets its own CSP nonce. Queries are small and indexed, and vote counts are stored on the options, so pages stay cheap to render.
