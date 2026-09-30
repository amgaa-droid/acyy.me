"use client";

import { Plus, Wallet } from "lucide-react";

import { BottomSheet } from "@/components/app/bottom-sheet";
import { formatMnt, mn } from "@/i18n/mn";

/** Header chip `💰 3,500₮ +` — opens the top-up sheet (flow is implemented in C5). */
export function WalletChip({ balance }: { balance: number }) {
  return (
    <BottomSheet
      title={mn.wallet.topUpSheetTitle}
      description={mn.wallet.topUpSoon}
      trigger={
        <button
          type="button"
          aria-label={`${mn.header.wallet}: ${formatMnt(balance)}. ${mn.header.topUp}`}
          className="flex h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-medium tabular-nums"
        >
          <Wallet className="size-4" aria-hidden />
          {formatMnt(balance)}
          <Plus className="size-4" aria-hidden />
        </button>
      }
    />
  );
}
