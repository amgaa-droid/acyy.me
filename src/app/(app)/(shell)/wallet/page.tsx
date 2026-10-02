import { Plus } from "lucide-react";
import type { Metadata } from "next";

import { TopUpSheet } from "@/components/app/top-up-sheet";
import { Button } from "@/components/ui/button";
import { formatMnt, mn } from "@/i18n/mn";
import { formatDateTime } from "@/lib/birth-date";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current";
import { db } from "@/server/db";
import { getBalance, listEntries } from "@/server/wallet";

export const metadata: Metadata = { title: mn.wallet.title };

export default async function WalletPage() {
  const { user } = await requireOnboardedUser();
  const [balance, entries] = await Promise.all([
    getBalance(db, user.id),
    listEntries(db, user.id, 100),
  ]);
  const t = mn.wallet;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
      <section className="flex flex-col gap-4 rounded-3xl bg-nav p-6 text-nav-active">
        <span className="text-xs font-semibold tracking-widest text-nav-fg uppercase">
          {t.balance}
        </span>
        <span
          className="font-heading text-6xl font-semibold tabular-nums"
          data-testid="wallet-balance"
        >
          {formatMnt(balance)}
        </span>
        <TopUpSheet
          returnTo="/wallet"
          trigger={
            <Button
              size="lg"
              className="rounded-full bg-nav-active text-nav-active-fg hover:bg-nav-active/90"
            >
              <Plus aria-hidden /> {t.topUp}
            </Button>
          }
        />
        <p className="text-xs text-nav-fg">{t.topUpSheetHint}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold lg:text-[28px]">{t.history}</h1>
        {entries.length === 0 ? (
          <p className="rounded-3xl bg-surface p-6 text-center text-muted-foreground">
            {t.historyEmpty}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-3xl bg-surface">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{t.types[e.type]}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {formatDateTime(e.createdAt)}
                    {e.note && ` · ${e.note}`}
                  </span>
                </span>
                <span className="flex flex-col items-end">
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      e.amount > 0 ? "text-highlight" : "text-fg",
                    )}
                  >
                    {e.amount > 0 ? "+" : "−"}
                    {formatMnt(Math.abs(e.amount))}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatMnt(e.balanceAfter)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
