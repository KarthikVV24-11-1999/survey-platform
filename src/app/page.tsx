import Link from "next/link";
import { ClockIcon, ListIcon, PlusIcon, SearchIcon, UsersIcon } from "@/components/icons";
import { Badge, ButtonLink, Card, EmptyState, cx } from "@/components/ui";
import { plural, relativeTime } from "@/lib/format";
import { type FeedSort, type FeedState, listPublishedPolls } from "@/server/polls/queries";

const SORTS: { value: FeedSort; label: string }[] = [
  { value: "new", label: "Newest" },
  { value: "trending", label: "Trending" },
  { value: "closing", label: "Closing soon" },
];
const STATES: { value: FeedState; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

type Search = { sort?: string; state?: string; q?: string; page?: string };

function pick<T extends string>(value: string | undefined, allowed: readonly { value: T }[], fallback: T): T {
  return allowed.some((a) => a.value === value) ? (value as T) : fallback;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const sort = pick(params.sort, SORTS, "new");
  const state = pick(params.state, STATES, "all");
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const page = Math.max(0, Math.min(50, Number.parseInt(params.page ?? "0", 10) || 0));
  const { polls, hasMore } = await listPublishedPolls({ sort, state, q, page });

  const href = (next: Partial<Search>) => {
    const merged = { sort, state, q, ...next };
    const qs = new URLSearchParams();
    if (merged.sort !== "new") qs.set("sort", merged.sort);
    if (merged.state !== "all") qs.set("state", merged.state);
    if (merged.q) qs.set("q", merged.q);
    if (next.page && next.page !== "0") qs.set("page", next.page);
    const s = qs.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-6 pt-2">
        <div className="max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            What do{" "}
            <span className="bg-linear-to-r from-[var(--accent)] to-[var(--accent-2)] bg-clip-text text-transparent">people think?</span>
          </h1>
          <p className="mt-3 text-muted">Ask a question, share the link, and see how people vote.</p>
        </div>
        <ButtonLink href="/polls/new" size="lg">
          <PlusIcon width={16} height={16} />
          Ask a question
        </ButtonLink>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form action="/" role="search" className="relative w-full max-w-sm">
          {sort !== "new" && <input type="hidden" name="sort" value={sort} />}
          {state !== "all" && <input type="hidden" name="state" value={state} />}
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search polls"
            aria-label="Search polls"
            maxLength={100}
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm shadow-card placeholder:text-muted/70 transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-ring/20"
          />
        </form>
        <div className="flex flex-wrap gap-2 text-sm">
          <Segmented items={SORTS} active={sort} href={(v) => href({ sort: v, page: "0" })} label="Sort" />
          {sort !== "closing" && (
            <Segmented items={STATES} active={state} href={(v) => href({ state: v, page: "0" })} label="Filter" />
          )}
        </div>
      </div>

      {polls.length === 0 ? (
        <EmptyState title={q ? "No polls match your search." : "No polls yet."}>
          {q ? "Try different words." : <Link href="/polls/new" className="text-accent underline underline-offset-2">Be the first to ask a question.</Link>}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {polls.map((poll) => (
            <li key={poll.id}>
              <Link href={`/polls/${poll.id}`} className="group block h-full">
                <Card className="flex h-full flex-col p-5 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-accent/40 group-hover:shadow-raised">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <StatusDot closed={poll.isClosed} />
                    {poll.kind === "multiple" && <Badge>Multiple choice</Badge>}
                    {poll.voterMode === "anonymous_allowed" && <Badge>Open to everyone</Badge>}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold leading-snug tracking-tight group-hover:text-accent">{poll.title}</h2>
                  {poll.optionPreview.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {poll.optionPreview.map((label, i) => (
                        <li key={i} className="max-w-full truncate rounded-md border border-border bg-subtle px-2 py-0.5 text-xs text-muted">
                          {label}
                        </li>
                      ))}
                      {poll.optionCount > poll.optionPreview.length && (
                        <li className="px-1 py-0.5 text-xs text-muted">+{poll.optionCount - poll.optionPreview.length} more</li>
                      )}
                    </ul>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                      <UsersIcon width={13} height={13} />
                      {plural(poll.ballotCount, "vote")}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ListIcon width={13} height={13} />
                      {plural(poll.optionCount, "option")}
                    </span>
                    {poll.closesAt && !poll.isClosed && (
                      <span className="flex items-center gap-1.5">
                        <ClockIcon width={13} height={13} />
                        closes {relativeTime(poll.closesAt)}
                      </span>
                    )}
                    <span className="ml-auto">
                      {poll.authorName ?? "deleted user"}
                      {poll.publishedAt && <> · {relativeTime(poll.publishedAt)}</>}
                    </span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(page > 0 || hasMore) && (
        <nav className="flex justify-between" aria-label="Pagination">
          {page > 0 ? <ButtonLink variant="secondary" href={href({ page: String(page - 1) })}>Newer</ButtonLink> : <span />}
          {hasMore && <ButtonLink variant="secondary" href={href({ page: String(page + 1) })}>Older</ButtonLink>}
        </nav>
      )}
    </div>
  );
}

function StatusDot({ closed }: { closed: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 font-medium", closed ? "text-muted" : "text-ok")}>
      <span className={cx("size-1.5 rounded-full", closed ? "bg-muted/60" : "bg-ok")} />
      {closed ? "Closed" : "Open"}
    </span>
  );
}

function Segmented<T extends string>({
  items,
  active,
  href,
  label,
}: {
  items: { value: T; label: string }[];
  active: T;
  href: (value: T) => string;
  label: string;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5 shadow-card" role="group" aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.value}
          href={href(item.value)}
          aria-current={item.value === active ? "page" : undefined}
          className={cx(
            "rounded-md px-3 py-1 transition",
            item.value === active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-fg",
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
