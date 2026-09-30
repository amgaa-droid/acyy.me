import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatMnt, mn } from "@/i18n/mn";
import { relationText } from "@/lib/people";
import { cn } from "@/lib/utils";
import { requireOwner } from "@/server/admin/guard";
import { getUserDetail } from "@/server/admin/users";
import { db } from "@/server/db";
import { listTopups } from "@/server/topups";
import { getBalance, ledgerSum, listEntries } from "@/server/wallet";
import { AdjustForm } from "./adjust-form";

export const metadata: Metadata = { title: mn.admin.nav.users };

const fmt = new Intl.DateTimeFormat("mn-MN", {
  timeZone: "Asia/Ulaanbaatar",
  dateStyle: "short",
  timeStyle: "short",
});

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  await requireOwner();
  const { id } = await params;
  const detail = await getUserDetail(db, id);
  if (!detail) notFound();
  const [balance, sum, entries, tops] = await Promise.all([
    getBalance(db, id),
    ledgerSum(db, id),
    listEntries(db, id, 100),
    listTopups(db, { userId: id, limit: 50 }),
  ]);
  const t = mn.admin.users;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/users"
        className="flex h-11 items-center gap-1 self-start rounded-full bg-surface pr-4 pl-2 text-sm font-semibold"
      >
        <ChevronLeft className="size-5" aria-hidden /> {mn.admin.nav.users}
      </Link>
      <div>
        <h1 className="text-[34px] leading-none font-semibold break-all">{detail.user.email}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {detail.user.name} · {t.joined} {fmt.format(detail.user.createdAt)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col gap-4">
          <section className="rounded-3xl bg-surface p-5">
            <div className="text-xs text-muted-foreground">{t.wallet}</div>
            <div className="text-4xl font-semibold tabular-nums" data-testid="admin-balance">
              {formatMnt(balance)}
            </div>
            <p
              className={cn(
                "mt-1 text-xs",
                sum === balance ? "text-muted-foreground" : "font-semibold text-destructive",
              )}
            >
              {sum === balance ? t.ledgerOk : t.ledgerBad(formatMnt(sum), formatMnt(balance))}
            </p>
          </section>
          <AdjustForm userId={id} idempotencyKey={`adjust:${crypto.randomUUID()}`} />
          <section className="rounded-3xl bg-surface p-5">
            <h2 className="mb-2 font-semibold">{t.people}</h2>
            <ul className="text-sm">
              {detail.people.map((p) => (
                <li key={p.id} className="flex justify-between py-1">
                  <span>{p.name}</span>
                  <span className="text-muted-foreground">
                    {relationText(p)} · {p.birthDate}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="overflow-hidden rounded-3xl bg-surface">
            <h2 className="px-5 pt-5 pb-2 font-semibold">{t.entries}</h2>
            <ul className="divide-y divide-border text-sm">
              {entries.map((e) => (
                <li key={e.id} className="flex justify-between gap-3 px-5 py-2.5">
                  <span className="min-w-0">
                    <span className="font-medium">{mn.wallet.types[e.type]}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {fmt.format(e.createdAt)} · {e.idempotencyKey}
                      {e.note && ` · ${e.note}`}
                    </span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className={cn("font-semibold", e.amount > 0 && "text-highlight")}>
                      {e.amount > 0 ? "+" : "−"}
                      {formatMnt(Math.abs(e.amount))}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatMnt(e.balanceAfter)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="overflow-hidden rounded-3xl bg-surface">
            <h2 className="px-5 pt-5 pb-2 font-semibold">{t.topups}</h2>
            <ul className="divide-y divide-border text-sm">
              {tops.map((tp) => (
                <li key={tp.id} className="flex justify-between px-5 py-2.5">
                  <span>{fmt.format(tp.createdAt)}</span>
                  <span className="tabular-nums">
                    {formatMnt(tp.amount)} · {mn.admin.topups.status[tp.status]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
