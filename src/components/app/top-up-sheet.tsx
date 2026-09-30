"use client";

import type { ReactElement } from "react";

import { BottomSheet } from "@/components/app/bottom-sheet";
import { mn } from "@/i18n/mn";

/** Top-up picker (tiers + QPay come in C5). */
export function TopUpSheet({ trigger }: { trigger: ReactElement }) {
  return (
    <BottomSheet
      title={mn.wallet.topUpSheetTitle}
      description={mn.wallet.topUpSoon}
      trigger={trigger}
    />
  );
}
