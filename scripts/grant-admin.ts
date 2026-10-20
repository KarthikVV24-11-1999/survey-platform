import "./load-env";
import { eq } from "drizzle-orm";
import { closeDb, db } from "../src/server/db/client";
import { auditLog, user } from "../src/server/db/schema";

// Sets a user's role. They need to have signed in once first.
//
//   npm run admin:grant -- someone@example.com [admin|moderator|user]
//   npm run admin:grant -- +919876543210 [admin|moderator|user]
async function main() {
  const [login, role = "admin"] = process.argv.slice(2);
  if (!login || !["admin", "moderator", "user"].includes(role)) {
    console.error("Usage: npm run admin:grant -- <email or +phone> [admin|moderator|user]");
    process.exit(1);
  }
  const key = login.trim();
  const target = await db().query.user.findFirst({
    where: key.startsWith("+") ? eq(user.phoneNumber, key.replace(/[^\d+]/g, "")) : eq(user.email, key.toLowerCase()),
  });
  if (!target) {
    console.error(`No account for ${login}. Sign in to the site once first.`);
    process.exit(1);
  }
  await db().transaction(async (tx) => {
    await tx.update(user).set({ role: role as "admin" | "moderator" | "user" }).where(eq(user.id, target.id));
    await tx.insert(auditLog).values({
      actorId: null,
      actorLabel: "cli:admin:grant",
      action: "user.role",
      targetType: "user",
      targetId: target.id,
      details: { from: target.role, to: role },
    });
  });
  console.log(`${login} is now ${role}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeDb);
