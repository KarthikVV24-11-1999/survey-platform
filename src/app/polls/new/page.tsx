import type { Metadata } from "next";
import { PollComposer } from "@/components/poll/composer";
import { Alert, PageHeader } from "@/components/ui";
import { postingDecision } from "@/server/auth/permissions";
import { requireViewerOrRedirect } from "@/server/auth/session";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "New poll" };

export default async function NewPollPage() {
  const viewer = await requireViewerOrRedirect("/polls/new");
  const settings = await getSettings();
  const posting = postingDecision(viewer, settings, new Date());

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Ask a question" description="Add options, context, and choose how people can vote." />
      {!posting.allowed ? (
        <Alert tone="warn" title="You can't post polls right now">
          {posting.reason}
        </Alert>
      ) : (
        <div className="space-y-4">
          {posting.notice && <Alert tone="neutral">{posting.notice}</Alert>}
          <PollComposer allowAnonymous={settings.allowAnonymousPolls} />
        </div>
      )}
    </div>
  );
}
