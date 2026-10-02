"use client";

import { Check, ShieldCheck } from "lucide-react";
import { useTransition } from "react";

import { confirmAdultAction } from "@/app/(app)/(shell)/readings/actions";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";

/** One-time "Би 18 нас хүрсэн" (SPEC §3). Only offered when the user's "Би" is 18+. */
export function AdultConfirm({ state }: { state: "confirmed" | "can_confirm" | "too_young" }) {
  const [pending, startTransition] = useTransition();
  const t = mn.me;
  return (
    <section className="flex flex-col gap-2 rounded-3xl bg-surface p-5">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <ShieldCheck className="size-5" aria-hidden /> {t.adultTitle}
      </h2>
      <p className="text-sm text-muted-foreground">
        {state === "too_young" ? t.adultTooYoung : t.adultBody}
      </p>
      {state === "confirmed" && (
        <p className="flex items-center gap-1 text-sm font-semibold text-highlight">
          <Check className="size-4" strokeWidth={2.5} aria-hidden /> {t.adultConfirmed}
        </p>
      )}
      {state === "can_confirm" && (
        <Button
          variant="outline"
          className="self-start rounded-full"
          disabled={pending}
          onClick={() => startTransition(async () => void (await confirmAdultAction()))}
        >
          {t.adultConfirm}
        </Button>
      )}
    </section>
  );
}
