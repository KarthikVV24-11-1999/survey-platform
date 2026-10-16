import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env";
import * as schema from "./schema";

function createDb() {
  const pool = new Pool({
    connectionString: env().DATABASE_URL,
    // small pool per instance, Neon's pooler does the rest
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
  });
  pool.on("error", (err) => console.error("[db] idle client error", err.message));
  return { pool, db: drizzle({ client: pool, schema, casing: "snake_case" }) };
}

type DbBundle = ReturnType<typeof createDb>;

// reuse the pool across hot reloads
const globalForDb = globalThis as unknown as { __surveyDb?: DbBundle };

export type Db = DbBundle["db"];
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Executor = Db | Tx;

// created lazily so importing this doesn't need env vars
export function db(): Db {
  globalForDb.__surveyDb ??= createDb();
  return globalForDb.__surveyDb.db;
}

export async function closeDb() {
  if (globalForDb.__surveyDb) {
    await globalForDb.__surveyDb.pool.end();
    globalForDb.__surveyDb = undefined;
  }
}

export { schema };
