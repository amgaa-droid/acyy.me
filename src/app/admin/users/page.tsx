import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { formatMnt, mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import { requireOwner } from "@/server/admin/guard";
import { searchUsers, userListQuerySchema, type UserListQuery } from "@/server/admin/users";
import { db } from "@/server/db";

export const metadata: Metadata = { title: mn.admin.nav.users };

const dateFmt = new Intl.DateTimeFormat("mn-MN", {
  timeZone: "Asia/Ulaanbaatar",
  dateStyle: "short",
  timeStyle: "short",
});
const fmtDate = (d: Date | string | null) => (d ? dateFmt.format(new Date(d)) : "—");

/** /admin/users?q=&sort=joined|topup&dir=asc|desc — keeps the other params when re-sorting. */
function usersHref(query: UserListQuery, patch: Partial<UserListQuery>) {
  const next = { ...query, ...patch };
  const p = new URLSearchParams({ sort: next.sort, dir: next.dir });
  if (next.q) p.set("q", next.q);
  return `/admin/users?${p}`;
}

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireOwner();
  const sp = await searchParams;
  const query = userListQuerySchema.parse(
    Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const rows = await searchUsers(db, query);
  const t = mn.admin.users;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-4xl leading-none font-semibold">{mn.admin.nav.users}</h1>
      <form action="/admin/users" className="relative max-w-md">
        <Search
          className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input type="hidden" name="sort" value={query.sort} />
        <input type="hidden" name="dir" value={query.dir} />
        <input
          name="q"
          defaultValue={query.q}
          aria-label={t.search}
          placeholder={t.search}
          className="h-11 w-full rounded-full bg-surface pr-4 pl-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>
      <div className="overflow-x-auto rounded-3xl bg-surface">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-3 font-medium">{t.email}</th>
              <th className="px-4 py-3 font-medium">{t.name}</th>
              <SortHeader query={query} col="joined" label={t.joined} />
              <SortHeader query={query} col="topup" label={t.lastTopup} />
              <th className="px-4 py-3 text-right font-medium">{t.balance}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-subtle">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/users/${r.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {r.email}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.name}</td>
                <td className="px-4 py-3 whitespace-nowrap tabular-nums">{fmtDate(r.createdAt)}</td>
                <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                  {fmtDate(r.lastTopupAt)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMnt(r.balance ?? 0)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  {t.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Header that sorts by its column: newest first on the first click, then flips. */
function SortHeader({
  query,
  col,
  label,
}: {
  query: UserListQuery;
  col: UserListQuery["sort"];
  label: string;
}) {
  const active = query.sort === col;
  const dir = active && query.dir === "desc" ? "asc" : "desc";
  const Icon = !active ? ArrowUpDown : query.dir === "desc" ? ArrowDown : ArrowUp;
  return (
    <th
      className="px-4 py-3 font-medium whitespace-nowrap"
      aria-sort={active ? (query.dir === "desc" ? "descending" : "ascending") : "none"}
    >
      <Link
        href={usersHref(query, { sort: col, dir })}
        className={cn(
          "inline-flex min-h-11 items-center gap-1 hover:text-fg",
          active && "font-semibold text-fg",
        )}
      >
        {label}
        <Icon className="size-3.5" aria-hidden />
      </Link>
    </th>
  );
}
