"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { RELATION_GROUPS } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { updateProductAction } from "../actions";

const t = mn.admin.productsPage;

type Product = {
  code: string;
  nameMn: string;
  price: number;
  isActive: boolean;
  adultOnly: boolean;
  allowedGroups: string[];
  personCount: number;
};

export function ProductForm({ product }: { product: Product }) {
  const [price, setPrice] = useState(String(product.price));
  const [isActive, setActive] = useState(product.isActive);
  const [adultOnly, setAdult] = useState(product.adultOnly);
  const [groups, setGroups] = useState(new Set(product.allowedGroups));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (g: string) =>
    setGroups((s) => {
      const n = new Set(s);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });

  const save = () =>
    startTransition(async () => {
      const res = await updateProductAction({
        code: product.code,
        price: Number(price),
        isActive,
        adultOnly,
        allowedGroups: [...groups],
      });
      setMsg(res.ok ? { ok: true, text: t.saved } : { ok: false, text: t.error });
    });

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5" aria-label={product.nameMn}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">{product.nameMn}</h2>
        <span className="font-mono text-xs text-muted-foreground">{product.code}</span>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t.price}
        <input
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
          className="h-11 rounded-2xl bg-subtle px-4 text-base tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <div className="flex gap-2">
        <Toggle label={t.active} on={isActive} onChange={setActive} />
        <Toggle label={t.adult} on={adultOnly} onChange={setAdult} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t.groups}</legend>
        <div className="flex flex-wrap gap-2">
          {RELATION_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={groups.has(g)}
              onClick={() => toggle(g)}
              className={cn(
                "h-10 rounded-full px-3.5 text-sm font-semibold",
                groups.has(g) ? "bg-primary text-primary-foreground" : "bg-subtle",
              )}
            >
              {t.groupNames[g]}
            </button>
          ))}
        </div>
      </fieldset>
      {msg && (
        <p role="status" className={cn("text-sm", msg.ok ? "text-highlight" : "text-destructive")}>
          {msg.text}
        </p>
      )}
      <Button className="rounded-full" disabled={pending} onClick={save}>
        {t.save}
      </Button>
    </section>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold",
        on ? "bg-tint-1 text-highlight" : "bg-subtle text-muted-foreground",
      )}
    >
      <span
        className={cn("size-2.5 rounded-full", on ? "bg-highlight" : "bg-border")}
        aria-hidden
      />
      {label}
    </button>
  );
}
