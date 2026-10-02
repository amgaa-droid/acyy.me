"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BottomSheet } from "@/components/app/bottom-sheet";
import { TopUpSheet } from "@/components/app/top-up-sheet";
import { Button } from "@/components/ui/button";
import { formatMnt, mn } from "@/i18n/mn";
import { purchaseAction } from "../../readings/actions";

const t = mn.buy;

type Props = {
  productCode: string;
  productName: string;
  personIds: string[];
  price: number;
  balance: number;
  /** Where a top-up paid outside the popup returns to (this page with ?confirm=1). */
  returnTo: string;
  autoOpen: boolean;
  subtitle: string;
};

/**
 * Sticky "Нээх · 1,000₮" + confirmation sheet (SPEC §6.1):
 * "1,000₮ хасагдана · Үлдэгдэл 3,500 → 2,500". Short balance → the top-up popup opens over
 * this sheet; once paid it closes and this sheet shows the new balance.
 */
export function BuyConfirm({
  productCode,
  productName,
  personIds,
  price,
  balance,
  returnTo,
  autoOpen,
  subtitle,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const enough = balance >= price;

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      const res = await purchaseAction({ productCode, personIds, price });
      if (res.ok) {
        router.push(`/r/${res.id}`);
        return;
      }
      setError(t.errors[res.error]);
      // Both mean this sheet is out of date: reload the balance / the price.
      if (res.error === "insufficient" || res.error === "price_changed") router.refresh();
    });

  const trigger = (
    <Button size="lg" className="rounded-full">
      {t.confirm(formatMnt(price))}
    </Button>
  );

  return (
    <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] z-30 flex flex-col gap-2 lg:bottom-6">
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={t.confirmTitle}
        description={`${subtitle} · ${productName}`}
        trigger={trigger}
        footer={
          <>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {enough ? (
              <Button size="lg" className="rounded-full" disabled={pending} onClick={confirm}>
                {t.confirm(formatMnt(price))}
              </Button>
            ) : (
              <TopUpSheet
                returnTo={returnTo}
                trigger={
                  <Button size="lg" className="rounded-full">
                    {t.topUpFirst}
                  </Button>
                }
              />
            )}
            <p className="text-center text-xs text-muted-foreground">{t.forever}</p>
          </>
        }
      >
        <dl className="flex flex-col divide-y divide-border rounded-2xl bg-subtle">
          <div className="flex justify-between px-4 py-3.5">
            <dt>{t.willCharge(formatMnt(price))}</dt>
          </div>
          <div className="flex justify-between gap-3 px-4 py-3.5">
            <dt className="font-semibold tabular-nums" data-testid="balance-change">
              {enough
                ? t.balanceChange(formatMnt(balance), formatMnt(balance - price))
                : `${mn.wallet.balance}: ${formatMnt(balance)}`}
            </dt>
          </div>
        </dl>
        {!enough && (
          <p className="mt-3 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {t.insufficient}
          </p>
        )}
      </BottomSheet>
    </div>
  );
}
