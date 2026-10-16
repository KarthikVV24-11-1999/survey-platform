# Scaling

Everything here is standard (Postgres, S3-compatible storage, OAuth and a stateless Node app), so growing is mostly a matter of upgrading plans and moving a few things out of the request path.

## Now

Free tiers: Vercel Hobby, Neon Free, R2 and Turnstile, OpenAI moderation. The limits to watch are Vercel usage (roughly 1M function calls and 100 GB of transfer a month), Neon (1 GB storage, 100 compute hours) and R2 (10 GB).

## When it gets real use

- Move to Vercel Pro, or run the Dockerfile on Cloud Run, Fly or similar. Hobby doesn't allow commercial use.
- Upgrade Neon for longer restore history, and add scheduled backups (`pg_dump` to a private bucket).
- Add error tracking such as Sentry.
- Put a custom domain behind Cloudflare.

## Heavier traffic

- Add a Neon read replica for the feed and poll pages.
- Turn on Better Auth's short cookie cache, or add Redis as secondary storage, to avoid a session query on every request.
- Move rate limiting to Redis. The function signature stays the same.
- Run moderation from a queue (QStash, SQS) instead of inline, and keep polls in review until the job finishes.

## Very popular polls

Each vote locks its poll's row. That keeps counts exact, but it limits a single poll to a few hundred votes a second. Past that, count votes in Redis or batch them, and reconcile from `ballots` now and then (the counts can always be rebuilt from it). Partitioning `ballots` by poll becomes worth it at a few hundred million rows.
