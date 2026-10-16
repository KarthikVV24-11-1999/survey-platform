import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local in CI
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  casing: "snake_case",
  strict: true,
  verbose: true,
  dbCredentials: {
    // prefer the direct (non-pooled) URL for migrations
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
