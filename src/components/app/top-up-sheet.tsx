"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState, useTransition, type ReactElement } from "react";

import { createTopupAction } from "@/app/(app)/(shell)/wallet/actions";
import { BottomSheet } from "@/components/app/bottom-sheet";
import { InvoicePanel } from "@/components/app/invoice-panel";
import { Button } from "@/components/ui/button";
import { useTopupPackages } from "@/components/app/topup-packages";
import { formatMnt, mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";

const t = mn.wallet;

type Created = Extract<Awaited<ReturnType<typeof createTopupAction>>, { ok: true }>;

/**
 * Top-up as one popup (SPEC §4.1, §4.3): pick a package → the QPay invoice → paid, without
 * leaving the page underneath (after payment it refreshes and closes). `returnTo` is where a
 * payment finished outside the popup lands (the mock bank page; defaults to the current page);
 * `afterPaid` navigates there on success instead of just closing.
 */
export function TopUpSheet({
  trigger,
  returnTo,
  afterPaid,
}: {
  trigger: ReactElement;
  returnTo?: string;
  afterPaid?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpenState] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const packages = useTopupPackages();
  const fallback = packages[Math.min(2, packages.length - 1)];
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const setOpen = (next: boolean) => {
    if (next) {
      setCreated(null);
      setError(null);
    }
    setOpenState(next);
  };
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
      setCreated(res);
    });

  const onContinue = useCallback(() => {
    setOpenState(false);
    if (afterPaid) router.push(afterPaid);
  }, [afterPaid, router]);

  if (created) {
    return (
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={t.invoice.title}
        trigger={trigger}
      >
        <InvoicePanel
          key={created.topup.id}
          topup={created.topup}
          balance={created.balance}
          mockPayUrl={
            created.mockPayUrl &&
            `${created.mockPayUrl}?next=${encodeURIComponent(returnTo ?? pathname)}`
          }
          onContinue={onContinue}
          retry={
            <Button size="lg" className="w-full rounded-full" onClick={() => setCreated(null)}>
              {t.invoice.again}
            </Button>
          }
        />
      </BottomSheet>
    );
  }

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
              "flex h-18 flex-col items-center justify-center rounded-3xl text-lg font-semibold tabular-nums transition-shadow",
              tier?.id === x.id
                ? "bg-tint-1 ring-2 ring-highlight"
                : "bg-subtle ring-1 ring-border hover:ring-2",
            )}
          >
            {formatMnt(x.amount)}
            {x.bonus > 0 && (
              <span className="text-xs font-medium text-highlight">
                {t.bonus(formatMnt(x.bonus))}
              </span>
            )}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
