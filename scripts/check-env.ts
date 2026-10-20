import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Checks an env file against the production rules and makes sure the database
// is reachable and migrated. Doesn't print any secrets.
//
//   npm run env:check -- .env.deploy
async function main() {
  const file = process.argv[2];
  if (file) process.loadEnvFile(file);
  Object.assign(process.env, { NODE_ENV: "production" });

  const { env } = await import("../src/server/env");
  const e = env(); // throws if anything is missing

  const on = (v: unknown) => (v ? "on" : "off");
  console.log("Configuration is valid for production.");
  console.log(`  App URL ............ ${e.APP_URL}`);
  console.log(`  GitHub sign-in ..... ${on(e.GITHUB_CLIENT_ID)}`);
  console.log(`  Google sign-in ..... ${on(e.GOOGLE_CLIENT_ID)}`);
  console.log(`  Email sign-in ...... ${on(e.RESEND_API_KEY)}`);
  console.log(`  Phone sign-in ...... ${on(e.TWILIO_VERIFY_SERVICE_SID)}`);
  console.log(`  AI moderation ...... ${on(e.OPENAI_API_KEY)}${e.OPENAI_API_KEY ? "" : "  (new polls will wait for a moderator)"}`);
  console.log(`  Storage ............ ${e.STORAGE_DRIVER} (${e.S3_BUCKET ?? "-"})`);
  console.log(`  Client IP header ... ${e.TRUSTED_IP_HEADER}`);

  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: unknown[] };
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || e.DATABASE_URL, max: 1 });
  try {
    const db = drizzle({ client: pool });
    const applied = await db
      .execute<{ n: number }>("select count(*)::int as n from drizzle.__drizzle_migrations")
      .then((r) => r.rows[0].n)
      .catch(() => 0);
    console.log(`  Database ........... reachable, ${applied}/${journal.entries.length} migrations applied`);
    if (applied < journal.entries.length) {
      console.error("Run `npm run db:migrate` against this database before deploying.");
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
