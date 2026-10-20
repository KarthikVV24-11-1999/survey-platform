import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccount } from "@/components/auth/delete-account";
import { DisplayNameForm } from "@/components/auth/display-name-form";
import { OpenBadge, StatusBadge } from "@/components/poll/status-badge";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDateTime, plural } from "@/lib/format";
import { contactLabel } from "@/lib/phone";
import { requireViewerOrRedirect } from "@/server/auth/session";
import { releaseNewAccountHolds } from "@/server/polls/holds";
import { listPollsByAuthor } from "@/server/polls/queries";

export const metadata: Metadata = { title: "My polls", robots: { index: false } };

export default async function MePage() {
  const viewer = await requireViewerOrRedirect("/me");
  await releaseNewAccountHolds({ authorId: viewer.id });
  const polls = await listPollsByAuthor(viewer.id);
  const contact = contactLabel(viewer.email);

  return (
    <div className="space-y-10">
      <section>
        <PageHeader title="My polls" description={`Signed in as ${contact}`} actions={<ButtonLink href="/polls/new">New poll</ButtonLink>} />
        {polls.length === 0 ? (
          <EmptyState title="You haven't posted any polls yet." />
        ) : (
          <ul className="grid gap-2">
            {polls.map((poll) => (
              <li key={poll.id}>
                <Link href={`/polls/${poll.id}`}>
                  <Card className="flex flex-wrap items-center gap-3 p-4 hover:border-accent/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{poll.title}</p>
                      <p className="text-xs text-muted">
                        {formatDateTime(poll.createdAt)} · {plural(poll.ballotCount, "vote")}
                      </p>
                      {poll.statusNote && poll.status !== "published" && <p className="mt-1 text-sm text-danger">{poll.statusNote}</p>}
                    </div>
                    {poll.status === "published" ? <OpenBadge isClosed={poll.isClosed} /> : <StatusBadge status={poll.status} />}
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Account</h2>
        <Card className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{contact}</span>
            {viewer.role !== "user" && <Badge tone="accent">{viewer.role}</Badge>}
            {viewer.trustLevel !== "standard" && <Badge>{viewer.trustLevel}</Badge>}
          </div>
          <DisplayNameForm name={viewer.name} />
          <DeleteAccount />
        </Card>
      </section>
    </div>
  );
}
