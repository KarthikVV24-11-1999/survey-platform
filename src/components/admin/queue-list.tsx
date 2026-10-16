import Link from "next/link";
import { formatDateTime, relativeTime } from "@/lib/format";
import { StatusBadge } from "../poll/status-badge";
import { Badge, Card, EmptyState } from "../ui";
import { PollModerationButtons } from "./poll-moderation-buttons";
import { TrustSelect } from "./user-controls";

type QueueItem = {
  id: string;
  title: string;
  descriptionMd: string;
  status: string;
  moderationReasons: string[];
  reportCount: number;
  createdAt: Date;
  authorId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  authorTrust: "restricted" | "standard" | "trusted" | null;
  authorCreatedAt: Date | null;
  options: string[];
  reports: { reason: string; details: string | null }[];
};

export function QueueList({ items, empty }: { items: QueueItem[]; empty: string }) {
  if (!items.length) return <EmptyState title={empty} />;
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.id}>
          <Card className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/polls/${item.id}`} className="font-medium hover:underline">
                  {item.title}
                </Link>
                <p className="mt-1 text-xs text-muted">
                  {formatDateTime(item.createdAt.toISOString())} · by {item.authorName ?? "deleted user"}
                  {item.authorEmail && <> ({item.authorEmail})</>}
                  {item.authorCreatedAt && <> · joined {relativeTime(item.authorCreatedAt.toISOString())}</>}
                </p>
              </div>
              <StatusBadge status={item.status} />
            </div>

            {item.moderationReasons.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.moderationReasons.map((r, i) => (
                  <Badge key={i} tone="warn">
                    {r}
                  </Badge>
                ))}
              </div>
            )}

            <div className="space-y-2 rounded-lg bg-subtle p-3 text-sm">
              {item.descriptionMd && <p className="line-clamp-4 whitespace-pre-wrap break-words text-muted">{item.descriptionMd}</p>}
              <ol className="list-decimal space-y-0.5 pl-5">
                {item.options.map((o, i) => (
                  <li key={i} className="break-words">
                    {o}
                  </li>
                ))}
              </ol>
            </div>

            {item.reports.length > 0 && (
              <div className="text-sm">
                <p className="font-medium">Open reports ({item.reports.length})</p>
                <ul className="mt-1 space-y-0.5 text-muted">
                  {item.reports.map((r, i) => (
                    <li key={i}>
                      <span className="text-fg">{r.reason.replace("_", " ")}</span>
                      {r.details && <>: {r.details}</>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
              <PollModerationButtons pollId={item.id} status={item.status} hasOpenReports={item.reports.length > 0} />
              {item.authorId && item.authorTrust && (
                <div className="text-sm">
                  <span className="mr-2 text-muted">Author can post:</span>
                  <TrustSelect userId={item.authorId} value={item.authorTrust} />
                </div>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
