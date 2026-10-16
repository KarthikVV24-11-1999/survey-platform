import { sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import { applyTestEnv } from "./test-env";

applyTestEnv();

const { db, closeDb } = await import("@/server/db/client");
const { clearSettingsCache } = await import("@/server/settings");

beforeEach(async () => {
  await db().execute(sql`
    truncate table
      users, sessions, accounts, verifications, auth_rate_limits,
      polls, poll_options, poll_attachments, media, ballots, ballot_choices,
      reports, moderation_events, audit_log, moderation_terms, site_settings, rate_limits
    restart identity cascade
  `);
  clearSettingsCache();
  // imported here so test files can mock the AI provider first
  const { clearTermsCache } = await import("@/server/moderation");
  clearTermsCache();
});

afterAll(async () => {
  await closeDb();
});
