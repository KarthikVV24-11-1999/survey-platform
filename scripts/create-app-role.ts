import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { Client } from "pg";

// Creates (or rotates) the restricted survey_app role and points DATABASE_URL in
// the env file at it. It can read and write rows but can't change the schema or
// edit the audit log. Migrations keep using the owner in DATABASE_URL_UNPOOLED.
//
//   npm run db:app-role -- .env.deploy
const ROLE = "survey_app";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npm run db:app-role -- <env-file>");
  const env = parseEnv(readFileSync(file, "utf8"));
  if (!env.DATABASE_URL_UNPOOLED || !env.DATABASE_URL) {
    throw new Error("The env file needs DATABASE_URL (pooled) and DATABASE_URL_UNPOOLED (owner, direct).");
  }

  const password = randomBytes(24).toString("base64url");
  const owner = new Client({ connectionString: env.DATABASE_URL_UNPOOLED });
  await owner.connect();
  try {
    const { rows } = await owner.query<{ role: string; db: string }>("select current_user as role, current_database() as db");
    const { role: ownerRole, db } = rows[0];
    if (ownerRole === ROLE) throw new Error("DATABASE_URL_UNPOOLED must use the owner role, not the app role.");
    const id = (s: string) => owner.escapeIdentifier(s);

    await owner.query("begin");
    const exists = (await owner.query("select 1 from pg_roles where rolname = $1", [ROLE])).rowCount! > 0;
    await owner.query(
      exists
        ? `alter role ${ROLE} with login password ${owner.escapeLiteral(password)}`
        : `create role ${ROLE} with login nosuperuser nocreatedb nocreaterole noreplication password ${owner.escapeLiteral(password)}`,
    );
    for (const statement of [
      `grant connect on database ${id(db)} to ${ROLE}`,
      `grant usage on schema public to ${ROLE}`,
      `grant select, insert, update, delete on all tables in schema public to ${ROLE}`,
      `grant usage, select on all sequences in schema public to ${ROLE}`,
      `revoke update, delete, truncate on audit_log from ${ROLE}`,
      `alter default privileges for role ${id(ownerRole)} in schema public grant select, insert, update, delete on tables to ${ROLE}`,
      `alter default privileges for role ${id(ownerRole)} in schema public grant usage, select on sequences to ${ROLE}`,
    ]) {
      await owner.query(statement);
    }
    await owner.query("commit");
    console.log(exists ? `Rotated the password of ${ROLE}.` : `Created ${ROLE}.`);
  } catch (err) {
    await owner.query("rollback").catch(() => {});
    throw err;
  } finally {
    await owner.end();
  }

  const lines = readFileSync(file, "utf8")
    .split("\n")
    .map((line) => {
      if (!line.startsWith("DATABASE_URL=")) return line;
      const url = new URL(line.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, ""));
      url.username = ROLE;
      url.password = password;
      return `DATABASE_URL=${url.toString()}`;
    });
  writeFileSync(file, lines.join("\n"), { mode: 0o600 });
  console.log(`Updated DATABASE_URL in ${file}. Copy it to your host's environment variables and redeploy.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
