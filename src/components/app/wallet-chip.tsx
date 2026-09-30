"use client";

import { Plus } from "lucide-react";

import { TopUpSheet } from "@/components/app/top-up-sheet";
import { formatMnt, mn } from "@/i18n/mn";

/** Header wallet pill `3,500₮ (+)` — opens the top-up sheet. */
export function WalletChip({ balance }: { balance: number }) {
  return (
    <TopUpSheet
      trigger={
        <button
          type="button"
          aria-label={`${mn.header.wallet}: ${formatMnt(balance)}. ${mn.header.topUp}`}
          className="flex h-11 items-center gap-2 rounded-full bg-surface pr-1.5 pl-4 text-sm font-semibold tabular-nums"
        >
          {formatMnt(balance)}
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Plus className="size-4" strokeWidth={2.2} aria-hidden />
          </span>
        </button>
      }
    />
  );
}
