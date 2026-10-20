# Security notes

A summary of how the app handles auth, input, abuse and data. To report a problem, see [SECURITY.md](../SECURITY.md).

## Accounts

There are no passwords. People sign in with Google, GitHub, a text message code or a one-time email link (Better Auth). Email links expire after 10 minutes and are stored hashed, and OAuth tokens are encrypted at rest. Phone codes are created and checked by Twilio Verify. Sending one needs a Turnstile check, only India and US mobile numbers are accepted, and texts are capped per number and per day to limit SMS fraud. Phone numbers are never shown publicly.

Sessions are stored in Postgres and looked up on every request, so sign-outs and bans apply immediately. A ban also deletes all of the user's sessions. Sign-in is rate limited and goes through a Turnstile check in production.

`role`, `trustLevel` and `banned` can't be set through any user-facing endpoint.

## Permissions

The rules live in `src/server/auth/permissions.ts` and are unit tested. Every server action and route handler checks the session itself, and each admin page checks permissions on its own rather than relying on the layout. Non-staff get a 404 on `/admin`.

Unpublished polls are only visible to their author and to staff. Vote counts aren't sent to the browser until the viewer is allowed to see results. Admins can't change their own role or ban themselves, and moderators can only change posting trust for regular users.

## Input and content

- All input is validated with Zod on the server. Text is trimmed and length limited, and zero-width and bidi control characters are removed.
- Markdown is rendered without raw HTML or images. Only http(s) and mailto links are allowed, and they get `rel="nofollow ugc noopener noreferrer"`.
- For videos only the YouTube or Vimeo id is stored. The embed URL is rebuilt from it and loaded in a sandboxed iframe.
- Uploaded images are decoded and re-encoded to WebP with sharp, which removes EXIF/GPS data. The format is detected from the file itself, SVG is refused, and there's a 4 MB / 40 megapixel limit. Images of rejected or removed polls return 404.

## Moderation

New polls go through admin word and domain lists, a profanity filter, some spam checks, and OpenAI's moderation model (text, uploaded images and video thumbnails). `src/server/moderation/decide.ts` turns that into publish, review or reject. If the moderation API is down, polls wait for review by default.

Once a poll is live, enough reports from different users hide it until a moderator looks at it. Every staff action goes into the audit log.

## Abuse

- Rate limits on posting, voting, uploads, reports and staff actions, plus a daily poll limit per user
- One ballot per voter per poll, enforced by a unique index. Each vote locks the poll row, and deadlines are checked against the database clock.
- Anonymous voting (only where the author allows it) needs a Turnstile check. Voters are identified by an HMAC of a random cookie and limited per network by an HMAC of the IP. Raw IPs and tokens are never stored.

## HTTP

Every page gets a CSP with a fresh nonce (`src/proxy.ts`), plus HSTS, `nosniff`, `X-Frame-Options: DENY`, a referrer policy and a permissions policy. Server actions check the Origin header, Better Auth checks origins against `APP_URL`, and the upload route checks Origin itself.

Cache Components is turned off because its prerendered shell can't carry a per-request nonce. It's worth revisiting once Next.js supports that.

## Data

- The app connects as a restricted `survey_app` role that can't change the schema or edit the audit log. Migrations use the owner role.
- Database connections use TLS with certificate verification, and all queries are parameterized.
- Secrets only come from environment variables, and the app won't start in production without the required ones.
- Deleting an account removes the profile and sign-ins. Polls stay without the author's name and votes stay as totals.

## CI

CI runs lint, type checks, unit and integration tests, a production dependency audit and a migration drift check. CodeQL and Dependabot are enabled, and GitHub Actions are pinned to commit SHAs.

## Known limits

- Anonymous voting can be gamed with new browsers or networks, so it's off by default per poll.
- Multiple accounts are slowed down by Turnstile, rate limits and new-account review, but not prevented.
- Neon's free plan only keeps 6 hours of history, so set up backups before the data matters.
- Images are cached for up to an hour, so a takedown can take that long to fully apply.
