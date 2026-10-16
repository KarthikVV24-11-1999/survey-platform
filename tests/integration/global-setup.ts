import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { applyTestEnv } from "./test-env";

export default async function setup() {
  const url = applyTestEnv();
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }
}
