import Link from "next/link";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { getAuditLog } from "@/server/admin/queries";
import { adminPageGuard } from "@/server/auth/session";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await adminPageGuard();
  const page = Math.max(0, Number.parseInt((await searchParams).page ?? "0", 10) || 0);
  const { entries, hasMore } = await getAuditLog(page);

  return (
    <div>
      <PageHeader title="Audit log" description="Every moderator and admin action, newest first. Entries cannot be edited or deleted from the app." />
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Who</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Target</th>
              <th className="px-4 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0 align-top">
                <td className="whitespace-nowrap px-4 py-2 text-muted">{formatDateTime(e.createdAt.toISOString())}</td>
                <td className="px-4 py-2">{e.actorLabel}</td>
                <td className="px-4 py-2 font-mono text-xs">{e.action}</td>
                <td className="px-4 py-2">
                  {e.targetType === "poll" ? (
                    <Link href={`/polls/${e.targetId}`} className="text-accent underline">
                      poll
                    </Link>
                  ) : (
                    <span className="text-muted">
                      {e.targetType}
                      {e.targetType === "user" && <span className="block font-mono text-xs">{e.targetId}</span>}
                    </span>
                  )}
                </td>
                <td className="max-w-md px-4 py-2 font-mono text-xs text-muted">
                  {Object.keys(e.details).length ? JSON.stringify(e.details) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <p className="px-4 py-8 text-center text-muted">No actions recorded yet.</p>}
      </Card>
      {(page > 0 || hasMore) && (
        <nav className="mt-4 flex justify-between">
          {page > 0 ? <ButtonLink variant="secondary" href={`/admin/audit?page=${page - 1}`}>Newer</ButtonLink> : <span />}
          {hasMore && <ButtonLink variant="secondary" href={`/admin/audit?page=${page + 1}`}>Older</ButtonLink>}
        </nav>
      )}
    </div>
  );
}
