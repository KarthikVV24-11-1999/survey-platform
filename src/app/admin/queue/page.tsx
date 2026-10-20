import { QueueList } from "@/components/admin/queue-list";
import { PageHeader } from "@/components/ui";
import { getReviewQueue } from "@/server/admin/queries";
import { staffPageGuard } from "@/server/auth/session";
import { releaseNewAccountHolds } from "@/server/polls/holds";

export default async function QueuePage() {
  await staffPageGuard();
  await releaseNewAccountHolds();
  const items = await getReviewQueue();
  return (
    <div>
      <PageHeader title="Review queue" description="Polls held by automatic checks, site policy, or user reports. Oldest first." />
      <QueueList items={items} empty="Nothing to review." />
    </div>
  );
}
