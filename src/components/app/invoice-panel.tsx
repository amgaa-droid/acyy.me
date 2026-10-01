"use client";

import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";

import { checkTopupAction } from "@/app/(app)/(shell)/wallet/actions";
import { Button } from "@/components/ui/button";
import { formatMnt, mn } from "@/i18n/mn";
import { qpayAppLink } from "@/lib/qpay-link";
import type { InvoiceData } from "@/server/db/schema";

const t = mn.wallet.invoice;
const POLL_MS = 3_000;
const AUTO_CONTINUE_MS = 2_500;

export type InvoiceTopup = {
  id: string;
  amount: number;
  bonus: number;
  status: string;
  invoice: InvoiceData | null;
};

type Props = {
  topup: InvoiceTopup;
  balance: number;
  /** Mock "bank app" page (QPAY_MODE=mock only); opens in a new tab so this panel keeps polling. */
  mockPayUrl: string | null;
  /** After a successful payment: on "Үргэлжлүүлэх", or by itself after a moment. */
  onContinue: () => void;
  /** Shown when the invoice expired or failed — starts a new top-up. */
  retry: ReactNode;
};

/**
 * QPay invoice (SPEC §4.3): the QPay app on phones, its QR on desktop. Polls
 * /api/topups/:id every 3 s. Rendered inside the top-up popup, and by /wallet/topup/[id]
 * when that URL is opened directly.
 */
export function InvoicePanel({ topup, balance: initialBalance, mockPayUrl, onContinue, retry }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(topup.status);
  const [balance, setBalance] = useState(initialBalance);
  const [checking, startCheck] = useTransition();

  useEffect(() => {
    if (status !== "pending") return;
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/topups/${topup.id}`, { cache: "no-store" });
        if (res.ok && !stopped) {
          const data = (await res.json()) as { status: string; balance: number };
          setStatus(data.status);
          setBalance(data.balance);
        }
      } catch {
        // offline for a moment — keep polling
      }
    };
    const timer = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [status, topup.id]);

  useEffect(() => {
    if (status !== "paid") return;
    router.refresh(); // header/sidebar balance, and the page under the popup
    const timer = setTimeout(onContinue, AUTO_CONTINUE_MS);
    return () => clearTimeout(timer);
  }, [status, onContinue, router]);

  const check = () =>
    startCheck(async () => {
      const res = await checkTopupAction(topup.id);
      if (res.status === "paid" || res.status === "expired" || res.status === "failed")
        setStatus(res.status);
    });

  if (status === "paid") {
    return (
      <Centered>
        <CheckCircle2 className="size-16 text-highlight" aria-hidden />
        <h2 className="text-[40px] leading-none font-semibold">{t.paid}</h2>
        <p className="text-muted-foreground" role="status">
          {t.paidBody(formatMnt(topup.amount + topup.bonus))}
        </p>
        <p className="text-2xl font-semibold tabular-nums">{formatMnt(balance)}</p>
        <Button size="lg" className="w-full rounded-full" onClick={onContinue}>
          {t.continue}
        </Button>
      </Centered>
    );
  }

  if (status === "expired" || status === "failed") {
    return (
      <Centered>
        <CircleAlert className="size-14 text-destructive" aria-hidden />
        <h2 className="text-3xl font-semibold" role="status">
          {status === "expired" ? t.expired : t.failed}
        </h2>
        {retry}
      </Centered>
    );
  }

  const inv = topup.invoice;
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <section className="rounded-[32px] bg-tint-1 p-6 text-center">
        <p className="text-xs font-semibold tracking-widest text-highlight uppercase">{t.amount}</p>
        <p className="mt-1 font-heading text-6xl font-semibold tabular-nums">
          {formatMnt(topup.amount)}
        </p>
        {topup.bonus > 0 && (
          <p className="mt-1 text-sm">{mn.wallet.bonus(formatMnt(topup.bonus))}</p>
        )}
      </section>

      {inv && (
        <>
          {/* Phones: open the QPay app directly. */}
          <section className="flex flex-col gap-2 lg:hidden">
            <Button
              size="lg"
              className="h-14 rounded-full text-base"
              render={<a href={qpayAppLink(inv)} />}
              nativeButton={false}
            >
              {t.payInApp}
            </Button>
            <p className="text-center text-sm text-muted-foreground">{t.payInAppHint}</p>
          </section>

          {/* Desktop: scan the QR with a phone. */}
          <section className="hidden flex-col items-center gap-3 rounded-[32px] bg-surface p-6 lg:flex">
            <p className="text-xl font-semibold">{t.scan}</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI from QPay */}
            <img
              src={inv.qrImage}
              alt="QPay QR"
              width={256}
              height={256}
              className="rounded-2xl bg-white p-2"
            />
          </section>
        </>
      )}

      <p
        className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t.waiting}
      </p>
      <Button
        variant="outline"
        size="lg"
        className="rounded-full"
        disabled={checking}
        onClick={check}
      >
        {t.check}
      </Button>

      {mockPayUrl && (
        <p className="rounded-2xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          {t.mockHint} ·{" "}
          <a
            href={mockPayUrl}
            target="_blank"
            rel="noopener"
            className="font-semibold text-highlight underline"
          >
            {t.mockOpen}
          </a>
        </p>
      )}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 py-6 text-center">
      {children}
    </div>
  );
}
