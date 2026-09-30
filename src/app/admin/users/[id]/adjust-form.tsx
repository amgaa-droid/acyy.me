"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import { adjustWalletAction } from "../../actions";

const t = mn.admin.users;

/** The idempotency key is minted per page render, so a double-click can't apply twice. */
export function AdjustForm({ userId, idempotencyKey }: { userId: string; idempotencyKey: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await adjustWalletAction({
        userId,
        amount: Number(amount),
        reason,
        idempotencyKey,
      });
      if (res.ok) {
        setMsg({ ok: true, text: t.adjusted });
        setAmount("");
        setReason("");
        router.refresh();
      } else setMsg({ ok: false, text: t.errors[res.error] });
    });

  const input =
    "h-11 rounded-2xl bg-subtle px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
      <h2 className="font-semibold">{t.adjustTitle}</h2>
      <p className="text-xs text-muted-foreground">{t.adjustHint}</p>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t.amount}
        <input
          className={cn(input, "tabular-nums")}
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d-]/g, ""))}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t.reason}
        <input
          className={input}
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {msg && (
        <p role="status" className={cn("text-sm", msg.ok ? "text-highlight" : "text-destructive")}>
          {msg.text}
        </p>
      )}
      <Button
        className="rounded-full"
        disabled={pending || !amount || reason.trim().length < 3}
        onClick={submit}
      >
        {t.adjust}
      </Button>
    </section>
  );
}
