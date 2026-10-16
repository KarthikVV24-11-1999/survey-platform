import { Badge, type Tone, cx } from "../ui";

const LABELS: Record<string, [string, Tone]> = {
  published: ["Published", "ok"],
  pending_review: ["Awaiting review", "warn"],
  rejected: ["Not published", "danger"],
  removed: ["Removed", "danger"],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, tone] = LABELS[status] ?? [status, "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}

export function OpenBadge({ isClosed }: { isClosed: boolean }) {
  return (
    <Badge tone={isClosed ? "neutral" : "ok"}>
      <span className={cx("size-1.5 rounded-full", isClosed ? "bg-muted/60" : "bg-ok")} />
      {isClosed ? "Closed" : "Open"}
    </Badge>
  );
}
