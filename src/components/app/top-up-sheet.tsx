"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { createTopupAction } from "@/app/(app)/wallet/actions";
import { BottomSheet } from "@/components/app/bottom-sheet";
import { Button } from "@/components/ui/button";
import { useTopupPackages } from "@/components/app/topup-packages";
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
  const packages = useTopupPackages();
  const fallback = packages[Math.min(2, packages.length - 1)];
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tier = packages.find((x) => x.id === picked) ?? fallback;
  const amount = tier?.amount ?? 0;

  const pay = () =>
    startTransition(async () => {
      setError(null);
      if (!tier) return;
      const res = await createTopupAction({
        packageId: tier.id,
        amount: tier.amount,
        bonus: tier.bonus,
      });
      if (!res.ok) {
        setError(t.errors[res.error]);
        // The packages changed since this page loaded: reload them so the sheet shows the new terms.
        if (res.error === "package_changed") router.refresh();
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
          <Button size="lg" className="rounded-full" disabled={pending || !tier} onClick={pay}>
            {t.payWithQpay(formatMnt(amount))}
          </Button>
          {tier && (
            <p className="text-center text-xs text-muted-foreground">
              {t.youGet(formatMnt(tier.amount + tier.bonus))}
            </p>
          )}
        </>
      }
    >
      {packages.length === 0 && <p className="text-sm text-muted-foreground">{t.noPackages}</p>}
      <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={t.topUpSheetTitle}>
        {packages.map((x) => (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={tier?.id === x.id}
            onClick={() => setPicked(x.id)}
            className={cn(
              "flex h-18 flex-col items-center justify-center rounded-3xl text-lg font-semibold tabular-nums transition-colors",
              tier?.id === x.id
                ? "bg-primary text-primary-foreground"
                : "bg-subtle ring-1 ring-border",
            )}
          >
            {formatMnt(x.amount)}
            {x.bonus > 0 && (
              <span
                className={cn(
                  "text-xs font-medium",
                  tier?.id === x.id ? "text-primary-foreground/75" : "text-highlight",
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
