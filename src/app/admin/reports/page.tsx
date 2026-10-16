import { QueueList } from "@/components/admin/queue-list";
import { PageHeader } from "@/components/ui";
import { getReportedPublished } from "@/server/admin/queries";
import { staffPageGuard } from "@/server/auth/session";
import { getSettings } from "@/server/settings";

export default async function ReportsPage() {
  await staffPageGuard();
  const [items, settings] = await Promise.all([getReportedPublished(), getSettings()]);
  return (
    <div>
      <PageHeader
        title="Reported polls"
        description={`Live polls with open reports. At ${settings.reportThreshold} reports a poll is hidden automatically and moves to the review queue.`}
      />
      <QueueList items={items} empty="No open reports." />
    </div>
  );
}
