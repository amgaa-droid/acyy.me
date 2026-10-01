"use client";

import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { TopUpSheet } from "@/components/app/top-up-sheet";
import { Button } from "@/components/ui/button";
import { formatMnt, mn } from "@/i18n/mn";
import { qpayAppLink } from "@/lib/qpay-link";
import type { InvoiceData } from "@/server/db/schema";
import { checkTopupAction } from "../../actions";

const t = mn.wallet.invoice;
const POLL_MS = 3_000;

type Props = {
  topup: { id: string; amount: number; bonus: number; status: string; invoice: InvoiceData | null };
  balance: number;
  next: string;
  mockPayUrl: string | null;
};

/**
 * Invoice screen (SPEC §4.3): QPay only — the QPay app on phones, its QR on desktop.
 * Polls /api/topups/:id every 3 s; on success returns the user to where they came from.
 */
export function InvoiceView({ topup, balance: initialBalance, next, mockPayUrl }: Props) {
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
    router.refresh(); // header/sidebar balance
    const timer = setTimeout(() => router.push(next), 2_500);
    return () => clearTimeout(timer);
  }, [status, next, router]);

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
        <h1 className="text-[40px] leading-none font-semibold">{t.paid}</h1>
        <p className="text-muted-foreground" role="status">
          {t.paidBody(formatMnt(topup.amount + topup.bonus))}
        </p>
        <p className="text-2xl font-semibold tabular-nums">{formatMnt(balance)}</p>
        <Button
          size="lg"
          className="rounded-full"
          render={<Link href={next} />}
          nativeButton={false}
        >
          {t.continue}
        </Button>
      </Centered>
    );
  }

  if (status === "expired" || status === "failed") {
    return (
      <Centered>
        <CircleAlert className="size-14 text-destructive" aria-hidden />
        <h1 className="text-3xl font-semibold" role="status">
          {status === "expired" ? t.expired : t.failed}
        </h1>
        <TopUpSheet
          returnTo={next}
          trigger={
            <Button size="lg" className="rounded-full">
              {t.again}
            </Button>
          }
        />
      </Centered>
    );
  }

  const inv = topup.invoice;
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
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
            <h1 className="text-xl font-semibold">{t.scan}</h1>
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
          <Link
            href={`${mockPayUrl}?next=${encodeURIComponent(next)}`}
            className="font-semibold text-highlight underline"
          >
            {t.mockOpen}
          </Link>
        </p>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-10 text-center">
      {children}
    </div>
  );
}
