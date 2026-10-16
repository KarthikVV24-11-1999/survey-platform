// Better Auth's tables plus our moderation fields on users. Keys must match
// Better Auth's field names; columns become snake_case via the Drizzle client.
import { bigint, boolean, index, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "moderator", "admin"]);
export const trustLevel = pgEnum("trust_level", ["restricted", "standard", "trusted"]);

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const user = pgTable("users", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  ...timestamps,
  // only set by admins (input: false in auth.ts)
  role: userRole().notNull().default("user"),
  trustLevel: trustLevel().notNull().default("standard"),
  banned: boolean().notNull().default(false),
  banReason: text(),
  bannedAt: timestamp({ withTimezone: true }),
});

export const session = pgTable(
  "sessions",
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    ...timestamps,
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index().on(t.userId), index().on(t.expiresAt)],
);

export const account = pgTable(
  "accounts",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    ...timestamps,
  },
  (t) => [index().on(t.userId)],
);

export const verification = pgTable(
  "verifications",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.identifier), index().on(t.expiresAt)],
);

export const rateLimit = pgTable("auth_rate_limits", {
  id: text().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: "number" }).notNull(),
});
