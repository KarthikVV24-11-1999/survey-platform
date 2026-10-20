import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import { auditLog, ballots, moderationTerms, pollOptions, polls, reports, user } from "../db/schema";

const PAGE = 50;

const authorColumns = {
  authorId: polls.authorId,
  authorName: user.name,
  authorEmail: user.email,
  authorTrust: user.trustLevel,
  authorCreatedAt: user.createdAt,
};

async function withQueueDetails<T extends { id: string }>(rows: T[]) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const idList = sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);
  const [options, reportRows] = await Promise.all([
    db()
      .select({ pollId: pollOptions.pollId, label: pollOptions.label })
      .from(pollOptions)
      .where(sql`${pollOptions.pollId} in (${idList})`)
      .orderBy(asc(pollOptions.position)),
    db()
      .select({ pollId: reports.pollId, reason: reports.reason, details: reports.details })
      .from(reports)
      .where(and(sql`${reports.pollId} in (${idList})`, eq(reports.status, "open"))),
  ]);
  return rows.map((r) => ({
    ...r,
    options: options.filter((o) => o.pollId === r.id).map((o) => o.label),
    reports: reportRows.filter((x) => x.pollId === r.id).map(({ reason, details }) => ({ reason, details })),
  }));
}

const queueColumns = {
  id: polls.id,
  title: polls.title,
  descriptionMd: polls.descriptionMd,
  status: polls.status,
  moderationReasons: polls.moderationReasons,
  reportCount: polls.reportCount,
  createdAt: polls.createdAt,
  ...authorColumns,
};

// oldest first
export async function getReviewQueue() {
  const rows = await db()
    .select(queueColumns)
    .from(polls)
    .leftJoin(user, eq(user.id, polls.authorId))
    .where(eq(polls.status, "pending_review"))
    .orderBy(asc(polls.createdAt))
    .limit(PAGE);
  return withQueueDetails(rows);
}

// live polls with open reports that haven't hit the auto-hide threshold
export async function getReportedPublished() {
  const rows = await db()
    .select(queueColumns)
    .from(polls)
    .leftJoin(user, eq(user.id, polls.authorId))
    .where(
      and(
        eq(polls.status, "published"),
        sql`exists (select 1 from ${reports} where ${reports.pollId} = ${polls.id} and ${reports.status} = 'open')`,
      ),
    )
    .orderBy(desc(polls.reportCount))
    .limit(PAGE);
  return withQueueDetails(rows);
}

export type AdminPollStatus = "pending_review" | "published" | "rejected" | "removed";
export type AdminPollSort = "new" | "votes" | "reports";

export async function listAllPolls(opts: { status?: AdminPollStatus; q?: string; sort: AdminPollSort; page: number }) {
  const q = opts.q?.trim().slice(0, 100);
  const order = {
    new: [desc(polls.createdAt)],
    votes: [desc(polls.ballotCount), desc(polls.createdAt)],
    reports: [desc(polls.reportCount), desc(polls.createdAt)],
  }[opts.sort];
  const rows = await db()
    .select({
      id: polls.id,
      title: polls.title,
      status: polls.status,
      ballotCount: polls.ballotCount,
      reportCount: polls.reportCount,
      createdAt: polls.createdAt,
      authorName: user.name,
      authorEmail: user.email,
    })
    .from(polls)
    .leftJoin(user, eq(user.id, polls.authorId))
    .where(
      and(
        opts.status ? eq(polls.status, opts.status) : undefined,
        q ? sql`${polls.search} @@ websearch_to_tsquery('english', ${q})` : undefined,
      ),
    )
    .orderBy(...order)
    .limit(PAGE + 1)
    .offset(Math.min(opts.page, 200) * PAGE);
  return { polls: rows.slice(0, PAGE), hasMore: rows.length > PAGE };
}

export async function getDashboardStats() {
  const [counts] = await db().execute<{
    users: number;
    new_users_7d: number;
    published: number;
    pending: number;
    rejected: number;
    removed: number;
    open_reports: number;
    ballots_24h: number;
  }>(sql`
    select
      (select count(*)::int from ${user}) as users,
      (select count(*)::int from ${user} where ${user.createdAt} > now() - interval '7 days') as new_users_7d,
      (select count(*)::int from ${polls} where ${polls.status} = 'published') as published,
      (select count(*)::int from ${polls} where ${polls.status} = 'pending_review') as pending,
      (select count(*)::int from ${polls} where ${polls.status} = 'rejected') as rejected,
      (select count(*)::int from ${polls} where ${polls.status} = 'removed') as removed,
      (select count(*)::int from ${reports} where ${reports.status} = 'open') as open_reports,
      (select count(*)::int from ${ballots} where ${ballots.updatedAt} > now() - interval '24 hours') as ballots_24h
  `).then((r) => r.rows);
  return counts;
}

export async function listUsers(opts: { q?: string; page: number }) {
  const q = opts.q?.trim().slice(0, 100);
  const pattern = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const rows = await db()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      trustLevel: user.trustLevel,
      banned: user.banned,
      banReason: user.banReason,
      createdAt: user.createdAt,
      // Plain SQL on purpose. Without a join Drizzle doesn't qualify select-list
      // columns, so ${user.id} would point at the inner table.
      pollCount: sql<number>`(select count(*)::int from polls p where p.author_id = "users"."id")`,
    })
    .from(user)
    .where(pattern ? or(ilike(user.email, pattern), ilike(user.name, pattern)) : undefined)
    .orderBy(desc(user.createdAt))
    .limit(PAGE + 1)
    .offset(Math.min(opts.page, 200) * PAGE);
  return { users: rows.slice(0, PAGE), hasMore: rows.length > PAGE };
}

export async function getAuditLog(page: number) {
  const rows = await db()
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(PAGE + 1)
    .offset(Math.min(page, 200) * PAGE);
  return { entries: rows.slice(0, PAGE), hasMore: rows.length > PAGE };
}

export async function listModerationTerms() {
  return db().select().from(moderationTerms).orderBy(asc(moderationTerms.kind), asc(moderationTerms.value));
}
