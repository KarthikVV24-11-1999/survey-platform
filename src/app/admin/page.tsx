import Link from "next/link";
import { Alert, Card, PageHeader, cx } from "@/components/ui";
import { getDashboardStats } from "@/server/admin/queries";
import { staffPageGuard } from "@/server/auth/session";
import { env } from "@/server/env";
import { getSettings } from "@/server/settings";

const POLICY_LABEL = {
  open: "Open (clean polls go live right away)",
  review_all: "Review all (polls from non-trusted users are reviewed)",
  trusted_only: "Trusted only (only trusted members can post)",
};

export default async function AdminOverview() {
  await staffPageGuard();
  const [stats, settings] = await Promise.all([getDashboardStats(), getSettings()]);
  const aiConfigured = Boolean(env().OPENAI_API_KEY);

  const tiles = [
    { label: "Awaiting review", value: stats.pending, href: "/admin/queue", highlight: stats.pending > 0 },
    { label: "Open reports", value: stats.open_reports, href: "/admin/reports", highlight: stats.open_reports > 0 },
    { label: "Published polls", value: stats.published, href: "/admin/polls?status=published" },
    { label: "Votes (24h)", value: stats.ballots_24h, href: "/admin/polls?status=published&sort=votes" },
    { label: "Users", value: stats.users, href: "/admin/users" },
    { label: "New users (7d)", value: stats.new_users_7d, href: "/admin/users" },
    { label: "Rejected", value: stats.rejected, href: "/admin/polls?status=rejected" },
    { label: "Removed", value: stats.removed, href: "/admin/polls?status=removed" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description={`Posting policy: ${POLICY_LABEL[settings.postingPolicy]}`} />
      {!aiConfigured && (
        <Alert tone="warn" title="AI moderation is not configured">
          Set OPENAI_API_KEY to check text and images automatically. Until then, new polls{" "}
          {settings.publishWhenAiUnavailable ? "are published after rule checks only." : "wait in the review queue."}
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href} className="group">
            <Card className={cx("p-4 transition group-hover:border-accent/60 group-hover:shadow-raised", tile.highlight && "border-warn/50")}>
              <p className="text-xs text-muted">{tile.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{tile.value.toLocaleString("en")}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
