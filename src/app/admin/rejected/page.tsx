import { QueueList } from "@/components/admin/queue-list";
import { PageHeader } from "@/components/ui";
import { getRecentlyRejected } from "@/server/admin/queries";
import { staffPageGuard } from "@/server/auth/session";

export default async function RejectedPage() {
  await staffPageGuard();
  const items = await getRecentlyRejected();
  return (
    <div>
      <PageHeader
        title="Rejected & removed"
        description="Last 14 days. Check for false positives, and look out for repeat offenders."
      />
      <QueueList items={items} empty="Nothing rejected or removed recently." />
    </div>
  );
}
