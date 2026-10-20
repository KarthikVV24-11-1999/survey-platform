import Link from "next/link";
import { StatusBadge } from "@/components/poll/status-badge";
import { ButtonLink, Card, Input, PageHeader, cx } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { contactLabel } from "@/lib/phone";
import { type AdminPollSort, type AdminPollStatus, listAllPolls } from "@/server/admin/queries";
import { staffPageGuard } from "@/server/auth/session";

const STATUSES: [AdminPollStatus | "", string][] = [
  ["", "All"],
  ["published", "Published"],
  ["pending_review", "Awaiting review"],
  ["rejected", "Rejected"],
  ["removed", "Removed"],
];
const SORTS: [AdminPollSort, string][] = [
  ["new", "Newest"],
  ["votes", "Most votes"],
  ["reports", "Most reports"],
];

type Params = { status?: string; q?: string; sort?: string; page?: string };

const tab = (active: boolean) => cx("rounded-lg px-3 py-1.5", active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-fg");

export default async function AdminPollsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await staffPageGuard();
  const params = await searchParams;
  const status = STATUSES.find(([v]) => v && v === params.status)?.[0] || undefined;
  const sort = SORTS.find(([v]) => v === params.sort)?.[0] ?? "new";
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const page = Math.max(0, Number.parseInt(params.page ?? "0", 10) || 0);
  const { polls, hasMore } = await listAllPolls({ status, q, sort, page });

  const href = (changes: Partial<Params>) => {
    const next = { status: status ?? "", q, sort: sort === "new" ? "" : sort, page: "", ...changes };
    const query = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
    return `/admin/polls${query.size ? `?${query}` : ""}`;
  };

  return (
    <div>
      <PageHeader title="Polls" description="Every poll on the site. Open one to approve, reject or remove it." />
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <div className="flex flex-wrap gap-1">
          {STATUSES.map(([value, label]) => (
            <Link key={label} href={href({ status: value })} className={tab((status ?? "") === value)}>
              {label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {SORTS.map(([value, label]) => (
            <Link key={value} href={href({ sort: value === "new" ? "" : value })} className={tab(sort === value)}>
              {label}
            </Link>
          ))}
        </div>
        <form role="search" className="w-full sm:ml-auto sm:w-56">
          {status && <input type="hidden" name="status" value={status} />}
          {sort !== "new" && <input type="hidden" name="sort" value={sort} />}
          <Input type="search" name="q" defaultValue={q} placeholder="Search titles…" aria-label="Search polls" maxLength={100} />
        </form>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Poll</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Votes</th>
              <th className="px-4 py-2 font-medium">Reports</th>
              <th className="px-4 py-2 font-medium">Posted</th>
            </tr>
          </thead>
          <tbody>
            {polls.map((p) => (
              <tr key={p.id} className="border-b border-border align-top last:border-0">
                <td className="max-w-md px-4 py-3">
                  <Link href={`/polls/${p.id}`} className="font-medium hover:text-accent">
                    {p.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {p.authorName ?? "Deleted account"}
                    {p.authorEmail && <> · {contactLabel(p.authorEmail)}</>}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 tabular-nums">{p.ballotCount.toLocaleString("en")}</td>
                <td className={cx("px-4 py-3 tabular-nums", p.reportCount > 0 && "text-danger")}>{p.reportCount}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(p.createdAt.toISOString())}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {polls.length === 0 && <p className="px-4 py-8 text-center text-muted">No polls found.</p>}
      </Card>
      {(page > 0 || hasMore) && (
        <nav className="mt-4 flex justify-between">
          {page > 0 ? <ButtonLink variant="secondary" href={href({ page: String(page - 1) })}>Previous</ButtonLink> : <span />}
          {hasMore && <ButtonLink variant="secondary" href={href({ page: String(page + 1) })}>Next</ButtonLink>}
        </nav>
      )}
    </div>
  );
}
