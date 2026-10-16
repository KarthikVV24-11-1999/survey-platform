# Survey Platform

A polling site where people post questions, others vote, and admins keep an eye on what gets published. Live at [survey-polls.vercel.app](https://survey-polls.vercel.app).

## Features

- Single or multiple choice polls with 2 to 10 options, optional images on each option
- Markdown descriptions, image uploads, links and YouTube/Vimeo embeds
- Optional deadlines, and control over when results are shown
- One vote per account, enforced in the database. Poll authors can also allow voting without an account (limited per browser and network)
- Automatic moderation using word and domain lists, a profanity filter, spam checks and OpenAI's moderation model for text and images
- Admin area with a review queue, user reports, roles, bans, posting rules and an audit log

## Stack

Next.js 16, React 19, TypeScript and Tailwind CSS, with Postgres (Neon) through Drizzle. Auth is Better Auth with Google, GitHub and email links. Images go to Cloudflare R2, Turnstile handles bot checks, and it's hosted on Vercel. Everything runs on free tiers at this scale.

## Running locally

You'll need Node 22+ and Postgres.

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, TEST_DATABASE_URL and the two secrets
npm run db:migrate
npm run seed                 # optional demo data
npm run dev
```

To sign in locally, use the email option. The sign-in link is printed in the terminal. Then make yourself an admin:

```bash
npm run admin:grant -- you@example.com
```

Without an `OPENAI_API_KEY`, new polls wait in the review queue until someone approves them.

## Scripts

| Command | |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run lint` / `npm run typecheck` | Lint and type check |
| `npm test` | Unit and integration tests (integration tests need `TEST_DATABASE_URL`) |
| `npm run db:generate` | Create a migration after changing the schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:app-role -- <file>` | Create or rotate the restricted database role |
| `npm run admin:grant -- <email>` | Make someone an admin |
| `npm run env:check -- <file>` | Check a production env file |
| `npm run env:fill -- <file>` | Fill in env values from the terminal |

Scripts use `.env.local` by default. To run one against production, prefix it with `ENV_FILE=.env.deploy`.

## Docs

- [Deployment](docs/deployment.md)
- [Architecture](docs/architecture.md)
- [Security](docs/security.md)
- [Scaling](docs/scaling.md)
