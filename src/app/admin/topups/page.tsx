import type { Metadata } from "next";
import Link from "next/link";

import { formatMnt, mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import { requireOwner } from "@/server/admin/guard";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { listTopups, type Topup } from "@/server/topups";
import { RecheckButton } from "./recheck-button";
import { inArray } from "drizzle-orm";

export const metadata: Metadata = { title: mn.admin.nav.topups };

const STATUSES = ["all", "pending", "paid", "expired", "failed"] as const;
const fmt = new Intl.DateTimeFormat("mn-MN", {
  timeZone: "Asia/Ulaanbaatar",
  dateStyle: "short",
  timeStyle: "short",
});

export default async function AdminTopupsPage({ searchParams }: PageProps<"/admin/topups">) {
  await requireOwner();
  const { status } = await searchParams;
  const current = STATUSES.includes(status as never)
    ? (status as (typeof STATUSES)[number])
    : "all";
  const rows = await listTopups(db, {
    status: current === "all" ? undefined : (current as Topup["status"]),
    limit: 200,
  });
  const emails = rows.length
    ? Object.fromEntries(
        (
          await db
            .select({ id: user.id, email: user.email })
            .from(user)
            .where(inArray(user.id, [...new Set(rows.map((r) => r.userId))]))
        ).map((u) => [u.id, u.email]),
      )
    : {};
  const t = mn.admin.topups;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[40px] leading-none font-semibold">{mn.admin.nav.topups}</h1>
      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/admin/topups" : `/admin/topups?status=${s}`}
            aria-current={s === current ? "page" : undefined}
            className={cn(
              "flex h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold",
              s === current ? "bg-primary text-primary-foreground" : "bg-surface",
            )}
          >
            {t.status[s]}
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-3xl bg-surface">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-3 font-medium">{t.created}</th>
              <th className="px-4 py-3 font-medium">{t.user}</th>
              <th className="px-4 py-3 text-right font-medium">{t.amount}</th>
              <th className="px-4 py-3 font-medium">{t.provider}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-3 whitespace-nowrap">{fmt.format(r.createdAt)}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/users/${r.userId}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {emails[r.userId] ?? r.userId}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMnt(r.amount)}
                  {r.bonus > 0 && (
                    <span className="text-muted-foreground"> +{formatMnt(r.bonus)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {t.status[r.status]} · {r.provider}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.status !== "paid" && r.invoiceId && <RecheckButton id={r.id} />}
                </td>
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
