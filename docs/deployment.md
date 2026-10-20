# Deployment

The production setup is Vercel (Hobby) for hosting, Neon for Postgres, Cloudflare R2 for images, Cloudflare Turnstile for bot checks, OpenAI for moderation, and Google/GitHub for sign-in. All of it is free at small scale. Vercel's Hobby plan is for non-commercial use, so move to Pro or use the Dockerfile if that changes.

Keep production values in a local `.env.deploy` file (git ignores it). `npm run env:fill -- .env.deploy` will prompt for each value so you don't have to edit the file by hand. Generate the three secrets (`BETTER_AUTH_SECRET`, `HASH_SECRET`, `CRON_SECRET`) with `openssl rand -base64 48`.

## 1. Database (Neon)

1. Create a project in the AWS us-east-1 region, which is close to Vercel's default region.
2. Copy the pooled connection string into `DATABASE_URL` and the direct one into `DATABASE_URL_UNPOOLED`. Change `sslmode=require` to `sslmode=verify-full` in both.
3. Create the tables:
   ```bash
   ENV_FILE=.env.deploy npm run db:migrate
   ```
4. Create the restricted role the app connects as. This rewrites `DATABASE_URL` to use it:
   ```bash
   npm run db:app-role -- .env.deploy
   ```

Later migrations can be run the same way, or with the "Migrate production database" workflow in GitHub Actions.

## 2. Images (Cloudflare R2)

1. Create a bucket (e.g. `survey-media`) and leave public access off. The app serves images itself.
2. Under R2 > Overview > Account Details > API Tokens, create an account token with Object Read & Write, limited to that bucket.
3. Set `STORAGE_DRIVER=s3`, `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`.

## 3. Moderation (OpenAI)

Create a key with restricted permissions, giving it only Moderations (Request), and set `OPENAI_API_KEY`. The moderation endpoint is free. Without a key, new polls wait for a moderator.

## 4. Hosting (Vercel)

1. Import the GitHub repo. No build settings need changing.
2. Add the environment variables for Production. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` has to be a config variable (it's public by design). Everything else can be secret. Leave out `DATABASE_URL_UNPOOLED`, since only migrations need it.
3. Add a domain under Settings > Domains and set `APP_URL` to it (https, no trailing slash).
4. Redeploy after any change to environment variables.

`TRUSTED_IP_HEADER=x-real-ip` is right for Vercel. The cleanup cron in `vercel.json` runs daily and uses `CRON_SECRET` automatically.

## 5. Bot checks (Turnstile)

Add a Managed widget for your domain and set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.

## 6. Sign-in

GitHub: create an OAuth app with the homepage set to `APP_URL` and the callback set to `APP_URL/api/auth/callback/github`.

Google: in Google Cloud, set up the consent screen (external, with the email, profile and openid scopes, and links to `/privacy` and `/terms`), publish it, then create a web client with `APP_URL` as the JavaScript origin and `APP_URL/api/auth/callback/google` as the redirect URI.

Email links need a domain verified with Resend (`RESEND_API_KEY`, `EMAIL_FROM`).

Phone codes use Twilio Verify. Create a Verify service, allow only India and the United States under its SMS geo permissions, and set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_VERIFY_SERVICE_SID`. Each successful sign-in costs about $0.05 plus the SMS fee. The app caps texts at 5 per number per hour and 100 a day in total. Sending to Indian numbers may need sender (DLT) registration, so test one before announcing it.

## 7. Check and finish

```bash
npm run env:check -- .env.deploy
```

Sign in once on the live site, then make yourself admin:

```bash
ENV_FILE=.env.deploy npm run admin:grant -- you@example.com
```

## Other hosts

```bash
docker build -t survey-platform .
docker run -p 3000:3000 --env-file .env.deploy survey-platform
```

Set `TRUSTED_IP_HEADER` to a header your host sets and clients can't fake (e.g. `cf-connecting-ip` behind Cloudflare). Avoid `x-forwarded-for` on hosts that append to it. You'll also need to call `/api/cron/cleanup` once a day with `Authorization: Bearer $CRON_SECRET`.
