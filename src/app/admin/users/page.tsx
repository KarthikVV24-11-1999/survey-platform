import { BanButton, RoleSelect, TrustSelect } from "@/components/admin/user-controls";
import { Badge, ButtonLink, Card, Input, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { contactLabel } from "@/lib/phone";
import { listUsers } from "@/server/admin/queries";
import { canManageUser, isAdmin } from "@/server/auth/permissions";
import { staffPageGuard } from "@/server/auth/session";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const viewer = await staffPageGuard();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const page = Math.max(0, Number.parseInt(params.page ?? "0", 10) || 0);
  const { users, hasMore } = await listUsers({ q, page });
  const admin = isAdmin(viewer);

  const pageHref = (p: number) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div>
      <PageHeader
        title="Users"
        description={admin ? "Manage roles, posting trust, and bans." : "Moderators can change whether regular users may post."}
      />
      <form className="mb-4 max-w-sm" role="search">
        <Input type="search" name="q" defaultValue={q} placeholder="Search by name or email…" aria-label="Search users" maxLength={100} />
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Joined</th>
              <th className="px-4 py-2 font-medium">Polls</th>
              <th className="px-4 py-2 font-medium">Posting</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0 align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {u.name} {u.id === viewer.id && <Badge>you</Badge>} {u.banned && <Badge tone="danger">banned</Badge>}
                  </p>
                  <p className="text-xs text-muted">{contactLabel(u.email)}</p>
                  {u.banned && u.banReason && <p className="text-xs text-danger">{u.banReason}</p>}
                </td>
                <td className="px-4 py-3 text-muted">{formatDateTime(u.createdAt.toISOString())}</td>
                <td className="px-4 py-3 tabular-nums">{u.pollCount}</td>
                <td className="px-4 py-3">
                  {canManageUser(viewer, u, "trust") ? <TrustSelect userId={u.id} value={u.trustLevel} /> : <Badge>{u.trustLevel}</Badge>}
                </td>
                <td className="px-4 py-3">
                  {canManageUser(viewer, u, "role") ? <RoleSelect userId={u.id} value={u.role} /> : <Badge tone={u.role === "user" ? "neutral" : "accent"}>{u.role}</Badge>}
                </td>
                <td className="px-4 py-3 text-right">{canManageUser(viewer, u, "ban") && <BanButton userId={u.id} banned={u.banned} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="px-4 py-8 text-center text-muted">No users found.</p>}
      </Card>
      {(page > 0 || hasMore) && (
        <nav className="mt-4 flex justify-between">
          {page > 0 ? <ButtonLink variant="secondary" href={pageHref(page - 1)}>Previous</ButtonLink> : <span />}
          {hasMore && <ButtonLink variant="secondary" href={pageHref(page + 1)}>Next</ButtonLink>}
        </nav>
      )}
    </div>
  );
}
