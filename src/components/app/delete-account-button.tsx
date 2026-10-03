"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteAccountAction } from "@/app/(app)/(shell)/me/actions";
import { BottomSheet } from "@/components/app/bottom-sheet";
import { Button } from "@/components/ui/button";
import { formatMnt, mn } from "@/i18n/mn";
import { authClient } from "@/lib/auth-client";
import type { DeletionSummary } from "@/server/account-deletion";

/** "Данс устгах" on /me: what will be lost, a checkbox, then the delete. */
export function DeleteAccountButton({ summary }: { summary: DeletionSummary }) {
  const t = mn.me.deleteAccount;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const losses = [
    summary.balance > 0 && t.balance(formatMnt(summary.balance)),
    summary.readings > 0 && t.readings(summary.readings),
    summary.people > 0 && t.people(summary.people),
    summary.linkedOthers > 0 && t.linked(summary.linkedOthers),
    t.always,
  ].filter((x): x is string => Boolean(x));

  return (
    <BottomSheet
      title={t.title}
      description={t.description}
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setAgreed(false);
          setError(false);
        }
      }}
      trigger={
        <Button variant="ghost" size="lg" className="rounded-full text-destructive lg:w-auto">
          <Trash2 aria-hidden /> {t.button}
        </Button>
      }
      footer={
        <Button
          variant="destructive"
          size="lg"
          className="rounded-full"
          disabled={!agreed || pending}
          onClick={() =>
            startTransition(async () => {
              setError(false);
              const res = await deleteAccountAction(true);
              if (!res.ok) {
                setError(true);
                return;
              }
              // The sessions are gone already; this clears the cookie.
              await authClient.signOut().catch(() => {});
              router.replace("/");
              router.refresh();
            })
          }
        >
          {t.submit}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-destructive/10 p-4">
          <p className="mb-2 text-sm font-semibold text-destructive">{t.lose}</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
            {losses.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted-foreground">
          {t.kept} {t.again}{" "}
          <Link href="/privacy#data-deletion" className="text-highlight underline">
            {t.privacy}
          </Link>
        </p>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="size-5 shrink-0 accent-destructive"
          />
          {t.confirm}
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t.error}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
