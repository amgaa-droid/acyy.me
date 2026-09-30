import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { formatMnt, mn } from "@/i18n/mn";
import { requireOwner } from "@/server/admin/guard";
import { searchUsers } from "@/server/admin/users";
import { db } from "@/server/db";

export const metadata: Metadata = { title: mn.admin.nav.users };

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireOwner();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const rows = await searchUsers(db, query);
  const t = mn.admin.users;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[40px] leading-none font-semibold">{mn.admin.nav.users}</h1>
      <form action="/admin/users" className="relative max-w-md">
        <Search
          className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          name="q"
          defaultValue={query}
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
                <td className="px-4 py-3 text-right tabular-nums">{formatMnt(r.balance ?? 0)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
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
