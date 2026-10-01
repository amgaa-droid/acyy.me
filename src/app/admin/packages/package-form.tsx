"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { formatMnt, mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import type { TopupPackage } from "@/server/topup-packages";
import {
  createPackageAction,
  deletePackageAction,
  updatePackageAction,
  type PackageResult,
} from "../actions";
import { Field, Status, Toggle, inputClass, type Msg } from "../products/ui";

const t = mn.admin.packages;

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 8);
const msgOf = (res: PackageResult, okText: string): Msg =>
  res.ok
    ? { ok: true, text: okText }
    : { ok: false, text: t.errors[res.error] ?? t.errors.generic };

type Draft = { amount: string; bonus: string; sort: string; isActive: boolean };

function Inputs({
  draft,
  set,
  amountLocked,
}: {
  draft: Draft;
  set: (d: Draft) => void;
  amountLocked?: boolean;
}) {
  const amount = Number(draft.amount) || 0;
  const bonus = Number(draft.bonus) || 0;
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Field label={t.amount}>
          <input
            className={inputClass}
            inputMode="numeric"
            disabled={amountLocked}
            value={draft.amount}
            onChange={(e) => set({ ...draft, amount: digits(e.target.value) })}
          />
        </Field>
        <Field label={t.bonus}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={draft.bonus}
            onChange={(e) => set({ ...draft, bonus: digits(e.target.value) })}
          />
        </Field>
        <Field label={t.sort}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={draft.sort}
            onChange={(e) => set({ ...draft, sort: digits(e.target.value).slice(0, 4) })}
          />
        </Field>
      </div>
      {amountLocked && <p className="-mt-2 text-xs text-muted-foreground">{t.amountLocked}</p>}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Toggle
          label={draft.isActive ? t.active : t.inactive}
          on={draft.isActive}
          onChange={(v) => set({ ...draft, isActive: v })}
        />
        {amount > 0 && (
          <span className="text-muted-foreground tabular-nums">
            {t.youGet(formatMnt(amount + bonus))}
            {bonus > 0 && ` · ${t.bonusPct(`${Math.round((bonus / amount) * 1000) / 10}%`)}`}
          </span>
        )}
      </div>
    </>
  );
}

const payload = (d: Draft) => ({
  amount: Number(d.amount),
  bonus: Number(d.bonus || 0),
  sort: Number(d.sort || 0),
  isActive: d.isActive,
});

export function NewPackage({ nextSort }: { nextSort: number }) {
  const router = useRouter();
  const empty: Draft = { amount: "", bonus: "0", sort: String(nextSort), isActive: true };
  const [draft, setDraft] = useState<Draft>(empty);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, startTransition] = useTransition();

  return (
    <details className="rounded-3xl bg-surface p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
        <Plus className="size-5" aria-hidden /> {t.new}
      </summary>
      <div className="mt-4 flex flex-col gap-4 lg:max-w-xl">
        <Inputs draft={draft} set={setDraft} />
        <Status msg={msg} />
        <Button
          className="rounded-full lg:w-48"
          disabled={pending || !Number(draft.amount)}
          onClick={() =>
            startTransition(async () => {
              const res = await createPackageAction(payload(draft));
              setMsg(msgOf(res, t.saved));
              if (res.ok) {
                setDraft({ ...empty, sort: String(nextSort + 1) });
                router.refresh();
              }
            })
          }
        >
          {t.create}
        </Button>
      </div>
    </details>
  );
}

/** `locked`: the package has top-ups (any status) — its price is fixed and it can't be deleted. */
export function PackageCard({
  pkg,
  sold,
  locked,
}: {
  pkg: TopupPackage;
  sold: number;
  locked: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({
    amount: String(pkg.amount),
    bonus: String(pkg.bonus),
    sort: String(pkg.sort),
    isActive: pkg.isActive,
  });
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<PackageResult>, okText: string) =>
    startTransition(async () => {
      const res = await fn();
      setMsg(msgOf(res, okText));
      if (res.ok) router.refresh();
    });

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-4 rounded-3xl bg-surface p-5",
        !pkg.isActive && "opacity-70",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-heading text-2xl font-semibold tabular-nums">
          {formatMnt(pkg.amount)}
          {pkg.bonus > 0 && (
            <span className="ml-2 text-base text-highlight">+{formatMnt(pkg.bonus)}</span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{t.sold(sold)}</span>
      </div>
      <Inputs draft={draft} set={setDraft} amountLocked={locked} />
      <Status msg={msg} />
      <div className="mt-auto flex gap-2">
        <Button
          className="rounded-full"
          disabled={pending || !Number(draft.amount)}
          onClick={() => run(() => updatePackageAction({ id: pkg.id, ...payload(draft) }), t.saved)}
        >
          {t.save}
        </Button>
        {!locked && (
          <Button
            variant="destructive"
            className="rounded-full"
            disabled={pending}
            onClick={() => {
              if (confirm(t.confirmDelete)) run(() => deletePackageAction(pkg.id), t.deleted);
            }}
          >
            <Trash2 aria-hidden /> {t.delete}
          </Button>
        )}
      </div>
    </div>
  );
}
