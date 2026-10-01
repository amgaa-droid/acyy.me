"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { InvoicePanel, type InvoiceTopup } from "@/components/app/invoice-panel";
import { TopUpSheet } from "@/components/app/top-up-sheet";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";

type Props = {
  topup: InvoiceTopup;
  balance: number;
  next: string;
  mockPayUrl: string | null;
};

/**
 * The invoice as a full page — only when /wallet/topup/[id] is opened directly (a refresh, the
 * mock bank page, a QPay return link). Top-ups started in the app show it inside the popup.
 */
export function InvoiceView({ topup, balance, next, mockPayUrl }: Props) {
  const router = useRouter();
  const onContinue = useCallback(() => router.push(next), [router, next]);

  return (
    <InvoicePanel
      topup={topup}
      balance={balance}
      mockPayUrl={mockPayUrl && `${mockPayUrl}?next=${encodeURIComponent(next)}`}
      onContinue={onContinue}
      retry={
        <TopUpSheet
          returnTo={next}
          afterPaid={next}
          trigger={
            <Button size="lg" className="rounded-full">
              {mn.wallet.invoice.again}
            </Button>
          }
        />
      }
    />
  );
}
