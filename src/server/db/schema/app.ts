import { sql } from "drizzle-orm";
import {
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

const createdAt = timestamp({ withTimezone: true }).notNull().defaultNow();

export const pollStatus = pgEnum("poll_status", ["pending_review", "published", "rejected", "removed"]);
export const pollKind = pgEnum("poll_kind", ["single", "multiple"]);
export const voterMode = pgEnum("voter_mode", ["signed_in", "anonymous_allowed"]);
export const resultsVisibility = pgEnum("results_visibility", ["always", "after_vote", "after_close"]);
export const attachmentKind = pgEnum("attachment_kind", ["image", "link", "video"]);
export const videoProvider = pgEnum("video_provider", ["youtube", "vimeo"]);
export const mediaStatus = pgEnum("media_status", ["active", "blocked"]);
export const reportReason = pgEnum("report_reason", [
  "spam",
  "harassment",
  "hate",
  "sexual",
  "violence",
  "self_harm",
  "misinformation",
  "illegal",
  "other",
]);
export const reportStatus = pgEnum("report_status", ["open", "resolved", "dismissed"]);
export const moderationSource = pgEnum("moderation_source", ["auto", "reports", "moderator"]);
export const moderationOutcome = pgEnum("moderation_outcome", [
  "publish",
  "review",
  "reject",
  "approve",
  "remove",
  "restore",
  "close",
]);
export const termKind = pgEnum("term_kind", ["word", "domain"]);
export const termAction = pgEnum("term_action", ["flag", "block"]);

export const media = pgTable(
  "media",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: text().references(() => user.id, { onDelete: "set null" }),
    storageKey: text().notNull().unique(),
    mime: text().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    bytes: integer().notNull(),
    sha256: text().notNull(),
    status: mediaStatus().notNull().default("active"),
    // moderation result from upload time
    moderation: jsonb().$type<MediaModeration>().notNull(),
    // null until used in a poll; unused uploads are cleaned up daily
    pollId: uuid().references(() => polls.id, { onDelete: "set null" }),
    createdAt,
  },
  (t) => [
    index().on(t.ownerId, t.createdAt),
    index("media_unattached_idx").on(t.createdAt).where(sql`${t.pollId} is null`),
  ],
);

export type MediaModeration = {
  flagged: boolean;
  available: boolean;
  categories: string[];
  scores: Record<string, number>;
};

export const polls = pgTable(
  "polls",
  {
    id: uuid().primaryKey().defaultRandom(),
    authorId: text().references(() => user.id, { onDelete: "set null" }),
    title: text().notNull(),
    descriptionMd: text().notNull().default(""),
    kind: pollKind().notNull().default("single"),
    maxChoices: smallint().notNull().default(1),
    voterMode: voterMode().notNull().default("signed_in"),
    resultsVisibility: resultsVisibility().notNull().default("always"),
    status: pollStatus().notNull(),
    // why it was held or rejected (staff only)
    moderationReasons: jsonb().$type<string[]>().notNull().default([]),
    // shown to the author when rejected or removed
    statusNote: text(),
    closesAt: timestamp({ withTimezone: true }),
    // set when voting is closed early
    closedAt: timestamp({ withTimezone: true }),
    ballotCount: integer().notNull().default(0),
    reportCount: integer().notNull().default(0),
    createdAt,
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    publishedAt: timestamp({ withTimezone: true }),
    search: tsvector().generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce("title", '')), 'A') || setweight(to_tsvector('english', coalesce("description_md", '')), 'B')`,
    ),
  },
  (t) => [
    index().on(t.status, t.publishedAt),
    index().on(t.status, t.closesAt),
    index().on(t.authorId, t.createdAt),
    index("polls_search_idx").using("gin", t.search),
    check("polls_title_length", sql`char_length(${t.title}) between 1 and 200`),
    check("polls_description_length", sql`char_length(${t.descriptionMd}) <= 5000`),
    check("polls_max_choices_range", sql`${t.maxChoices} between 1 and 10`),
    check("polls_counts_nonnegative", sql`${t.ballotCount} >= 0 and ${t.reportCount} >= 0`),
  ],
);

export const pollOptions = pgTable(
  "poll_options",
  {
    id: uuid().primaryKey().defaultRandom(),
    pollId: uuid()
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    label: text().notNull(),
    mediaId: uuid().references(() => media.id, { onDelete: "set null" }),
    voteCount: integer().notNull().default(0),
  },
  (t) => [
    uniqueIndex().on(t.pollId, t.position),
    check("poll_options_label_length", sql`char_length(${t.label}) between 1 and 200`),
    check("poll_options_vote_count_nonnegative", sql`${t.voteCount} >= 0`),
  ],
);

export const pollAttachments = pgTable(
  "poll_attachments",
  {
    id: uuid().primaryKey().defaultRandom(),
    pollId: uuid()
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    kind: attachmentKind().notNull(),
    mediaId: uuid().references(() => media.id, { onDelete: "set null" }),
    url: text(),
    videoProvider: videoProvider(),
    videoId: text(),
    title: text(),
  },
  (t) => [uniqueIndex().on(t.pollId, t.position)],
);

export const ballots = pgTable(
  "ballots",
  {
    id: uuid().primaryKey().defaultRandom(),
    pollId: uuid()
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    userId: text().references(() => user.id, { onDelete: "set null" }),
    // u:<userId>, or a:<hmac of the anonymous cookie>
    voterKey: text().notNull(),
    // hmac(poll id + ip), anonymous ballots only
    ipHash: text(),
    createdAt,
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex().on(t.pollId, t.voterKey), index().on(t.pollId, t.ipHash), index().on(t.userId)],
);

export const ballotChoices = pgTable(
  "ballot_choices",
  {
    ballotId: uuid()
      .notNull()
      .references(() => ballots.id, { onDelete: "cascade" }),
    optionId: uuid()
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),
    pollId: uuid()
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.ballotId, t.optionId] }), index().on(t.optionId)],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    pollId: uuid()
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    reporterId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: reportReason().notNull(),
    details: text(),
    status: reportStatus().notNull().default("open"),
    resolvedById: text().references(() => user.id, { onDelete: "set null" }),
    resolvedAt: timestamp({ withTimezone: true }),
    createdAt,
  },
  (t) => [
    uniqueIndex().on(t.pollId, t.reporterId),
    index().on(t.status, t.createdAt),
    check("reports_details_length", sql`char_length(${t.details}) <= 1000`),
  ],
);

export const moderationEvents = pgTable(
  "moderation_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    pollId: uuid().references(() => polls.id, { onDelete: "cascade" }),
    source: moderationSource().notNull(),
    outcome: moderationOutcome().notNull(),
    actorId: text().references(() => user.id, { onDelete: "set null" }),
    reasons: jsonb().$type<string[]>().notNull().default([]),
    scores: jsonb().$type<Record<string, number>>().notNull().default({}),
    createdAt,
  },
  (t) => [index().on(t.pollId, t.createdAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    actorId: text().references(() => user.id, { onDelete: "set null" }),
    // copy of the email so entries survive account deletion
    actorLabel: text().notNull(),
    action: text().notNull(),
    targetType: text().notNull(),
    targetId: text().notNull(),
    details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt,
  },
  (t) => [index().on(t.createdAt), index().on(t.targetType, t.targetId)],
);

export const moderationTerms = pgTable(
  "moderation_terms",
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: termKind().notNull(),
    value: text().notNull(),
    action: termAction().notNull(),
    createdById: text().references(() => user.id, { onDelete: "set null" }),
    createdAt,
  },
  (t) => [
    uniqueIndex().on(t.kind, t.value),
    check("moderation_terms_value_length", sql`char_length(${t.value}) between 1 and 100`),
  ],
);

export const siteSettings = pgTable(
  "site_settings",
  {
    id: smallint().primaryKey().default(1),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
    updatedById: text().references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("site_settings_singleton", sql`${t.id} = 1`)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text().primaryKey(),
  windowStart: timestamp({ withTimezone: true }).notNull(),
  count: integer().notNull(),
});
