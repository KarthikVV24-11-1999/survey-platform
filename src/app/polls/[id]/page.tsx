import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { ClockIcon } from "@/components/icons";
import { PollModerationButtons } from "@/components/admin/poll-moderation-buttons";
import { Markdown } from "@/components/markdown";
import { PollAttachments } from "@/components/poll/attachments";
import { Countdown } from "@/components/poll/countdown";
import { OwnerActions } from "@/components/poll/owner-actions";
import { ReportButton } from "@/components/poll/report-button";
import { ShareButton } from "@/components/poll/share-button";
import { OpenBadge, StatusBadge } from "@/components/poll/status-badge";
import { VotePanel, type VotePanelProps } from "@/components/poll/vote-panel";
import { Alert, Badge, Card } from "@/components/ui";
import { formatDateTime, initials, relativeTime } from "@/lib/format";
import { getViewer } from "@/server/auth/session";
import { getPollView } from "@/server/polls/queries";
import { getSettings } from "@/server/settings";

type Params = { params: Promise<{ id: string }> };

// cached per request so generateMetadata and the page share the queries
const load = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) return null;
  const viewer = await getViewer();
  const anonToken = viewer ? null : ((await cookies()).get("sp_voter")?.value ?? null);
  const poll = await getPollView(id, viewer, anonToken);
  return poll ? { poll, viewer } : null;
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load((await params).id);
  if (!data) return { title: "Poll not found", robots: { index: false } };
  return {
    title: data.poll.title,
    robots: data.poll.status === "published" ? undefined : { index: false, follow: false },
  };
}

export default async function PollPage({ params }: Params) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();
  const { poll, viewer } = data;
  const settings = await getSettings();

  let blocked: VotePanelProps["blocked"] = null;
  if (poll.status !== "published") blocked = { reason: "not_published" };
  else if (poll.isClosed) blocked = { reason: "closed" };
  else if (!viewer && (poll.voterMode === "signed_in" || !settings.allowAnonymousPolls)) {
    blocked = { reason: "sign_in", signInHref: `/sign-in?next=${encodeURIComponent(`/polls/${poll.id}`)}` };
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      {poll.status !== "published" && (
        <Alert
          tone={poll.status === "pending_review" ? "warn" : "danger"}
          title={
            poll.status === "pending_review"
              ? "This poll is waiting for a moderator"
              : poll.status === "rejected"
                ? "This poll was not published"
                : "This poll was removed"
          }
        >
          {poll.status === "pending_review"
            ? "Only you and the moderators can see it until it is approved."
            : poll.statusNote}
        </Alert>
      )}

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {poll.status === "published" ? <OpenBadge isClosed={poll.isClosed} /> : <StatusBadge status={poll.status} />}
          {poll.kind === "multiple" && <Badge>Pick up to {poll.maxChoices}</Badge>}
          {poll.voterMode === "anonymous_allowed" && <Badge>Open to everyone</Badge>}
          {poll.closesAt && (
            <Badge className="ml-auto">
              <ClockIcon width={12} height={12} />
              {poll.isClosed ? `Closed ${formatDateTime(poll.closesAt)}` : <Countdown closesAt={poll.closesAt} />}
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{poll.title}</h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm text-muted">
            <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
              {initials(poll.author?.name ?? "?")}
            </span>
            <span>
              <span className="font-medium text-fg">{poll.author?.name ?? "Deleted user"}</span>
              {poll.publishedAt && <> · {relativeTime(poll.publishedAt)}</>}
            </span>
          </div>
          {poll.status === "published" && <ShareButton />}
        </div>
      </header>

      {(poll.descriptionMd || poll.attachments.length > 0) && (
        <section className="space-y-4">
          {poll.descriptionMd && <Markdown>{poll.descriptionMd}</Markdown>}
          <PollAttachments items={poll.attachments} />
        </section>
      )}

      <Card className="p-5 sm:p-7">
        <VotePanel
          pollId={poll.id}
          kind={poll.kind}
          maxChoices={poll.maxChoices}
          options={poll.options}
          ballotCount={poll.ballotCount}
          myChoices={poll.myChoices}
          resultsVisible={poll.resultsVisible}
          resultsVisibility={poll.resultsVisibility}
          blocked={blocked}
          anonymous={!viewer}
        />
      </Card>

      <div className="flex flex-wrap items-start justify-between gap-4">
        {poll.isAuthor ? (
          <OwnerActions
            pollId={poll.id}
            canClose={poll.status === "published" && !poll.isClosed}
            canDelete={poll.status === "published" || poll.status === "pending_review"}
          />
        ) : (
          <span />
        )}
        {viewer && !poll.isAuthor && poll.status === "published" && <ReportButton pollId={poll.id} alreadyReported={poll.hasReported} />}
        {!viewer && poll.status === "published" && (
          <Link href={`/sign-in?next=${encodeURIComponent(`/polls/${poll.id}`)}`} className="text-sm text-muted hover:text-fg">
            Sign in to report
          </Link>
        )}
      </div>

      {poll.moderation && (
        <Card className="space-y-4 border-dashed p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Moderation</h2>
            <StatusBadge status={poll.status} />
          </div>
          {poll.moderation.reasons.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {poll.moderation.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          <PollModerationButtons pollId={poll.id} status={poll.status} />
          {poll.isAuthor === false && !poll.isClosed && poll.status === "published" && (
            <OwnerActions pollId={poll.id} canClose canDelete={false} />
          )}
          {poll.moderation.events.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">History</summary>
              <ul className="mt-2 space-y-1">
                {poll.moderation.events.map((e, i) => (
                  <li key={i} className="text-muted">
                    {formatDateTime(e.createdAt)} · {e.source}: <span className="text-fg">{e.outcome}</span>
                    {e.reasons.length > 0 && <> ({e.reasons.join("; ")})</>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      )}
    </article>
  );
}
