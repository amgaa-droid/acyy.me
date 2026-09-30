"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { createTopupAction } from "@/app/(app)/wallet/actions";
import { BottomSheet } from "@/components/app/bottom-sheet";
import { Button } from "@/components/ui/button";
import { TOPUP_TIERS } from "@/config/topup";
import { formatMnt, mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";

const t = mn.wallet;

/**
 * Top-up picker (SPEC §4.1). `returnTo` is where the invoice screen sends the user after a
 * successful payment (defaults to the current page, e.g. back to a purchase confirmation).
 */
export function TopUpSheet({ trigger, returnTo }: { trigger: ReactElement; returnTo?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(TOPUP_TIERS[2].amount);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tier = TOPUP_TIERS.find((x) => x.amount === amount)!;

  const pay = () =>
    startTransition(async () => {
      setError(null);
      const res = await createTopupAction(amount);
      if (!res.ok) {
        setError(t.errors[res.error]);
        return;
      }
      setOpen(false);
      const next = returnTo ?? pathname;
      router.push(`/wallet/topup/${res.id}?next=${encodeURIComponent(next)}`);
    });

  return (
    <BottomSheet
      open={open}
      onOpenChange={setOpen}
      title={t.topUpSheetTitle}
      description={t.topUpSheetHint}
      trigger={trigger}
      footer={
        <>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button size="lg" className="rounded-full" disabled={pending} onClick={pay}>
            {t.payWithQpay(formatMnt(amount))}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {t.youGet(formatMnt(tier.amount + tier.bonus))}
          </p>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={t.topUpSheetTitle}>
        {TOPUP_TIERS.map((x) => (
          <button
            key={x.amount}
            type="button"
            role="radio"
            aria-checked={amount === x.amount}
            onClick={() => setAmount(x.amount)}
            className={cn(
              "flex h-18 flex-col items-center justify-center rounded-3xl text-lg font-semibold tabular-nums transition-colors",
              amount === x.amount
                ? "bg-primary text-primary-foreground"
                : "bg-subtle ring-1 ring-border",
            )}
          >
            {formatMnt(x.amount)}
            {x.bonus > 0 && (
              <span
                className={cn(
                  "text-xs font-medium",
                  amount === x.amount ? "text-primary-foreground/75" : "text-highlight",
                )}
              >
                {t.bonus(formatMnt(x.bonus))}
              </span>
            )}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
