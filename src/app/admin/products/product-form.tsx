"use client";

import { useState, useTransition } from "react";

import {
  PRODUCT_ICON_COMPONENTS,
  PRODUCT_TINT_CLASSES,
  ProductIcon,
} from "@/components/readings/product-icon";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { PRODUCT_ICONS, PRODUCT_TINTS, RELATION_GROUPS } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { updateProductAction } from "../actions";
import { Field, Status, Toggle, inputClass, resultMsg, type Msg } from "./ui";

const t = mn.admin.productsPage;

export type ProductSettings = {
  code: string;
  nameMn: string;
  description: string;
  price: number;
  isActive: boolean;
  adultOnly: boolean;
  allowedGroups: string[];
  sort: number;
  icon: string;
  tint: string;
};

/** Name, catalogue text, price, visibility (groups, 18+), active, order and tile look. */
export function ProductForm({ product }: { product: ProductSettings }) {
  const [nameMn, setName] = useState(product.nameMn);
  const [description, setDescription] = useState(product.description);
  const [price, setPrice] = useState(String(product.price));
  const [sort, setSort] = useState(String(product.sort));
  const [isActive, setActive] = useState(product.isActive);
  const [adultOnly, setAdult] = useState(product.adultOnly);
  const [groups, setGroups] = useState(new Set(product.allowedGroups));
  const [icon, setIcon] = useState(product.icon);
  const [tint, setTint] = useState(product.tint);
  const [msg, setMsg] = useState<Msg>(null);
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
        nameMn,
        description,
        price: Number(price),
        sort: Number(sort || 0),
        isActive,
        adultOnly,
        allowedGroups: [...groups],
        icon,
        tint,
      });
      const m = resultMsg(res, t.saved);
      setMsg(
        res.ok && res.missing
          ? { ok: false, text: `${t.saved} ${t.activeWarning(res.missing)}` }
          : m,
      );
    });

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5" aria-label={t.settings}>
      <div className="flex items-center gap-3">
        <ProductIcon product={{ icon, tint }} />
        <h2 className="text-xl font-semibold">{t.settings}</h2>
      </div>
      <Field label={t.name}>
        <input
          className={inputClass}
          value={nameMn}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label={t.description}>
        <textarea
          className={cn(inputClass, "h-auto min-h-20 py-3")}
          value={description}
          maxLength={300}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.price}>
          <input
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
            className={cn(inputClass, "tabular-nums")}
          />
        </Field>
        <Field label={t.sort}>
          <input
            inputMode="numeric"
            value={sort}
            onChange={(e) => setSort(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className={cn(inputClass, "tabular-nums")}
          />
        </Field>
      </div>
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
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t.icon}</legend>
        <div className="flex flex-wrap gap-1.5">
          {PRODUCT_ICONS.map((name) => {
            const Icon = PRODUCT_ICON_COMPONENTS[name];
            return (
              <button
                key={name}
                type="button"
                aria-label={name}
                aria-pressed={icon === name}
                onClick={() => setIcon(name)}
                className={cn(
                  "flex size-11 items-center justify-center rounded-2xl",
                  icon === name ? "bg-primary text-primary-foreground" : "bg-subtle",
                )}
              >
                <Icon className="size-5" aria-hidden />
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t.tint}</legend>
        <div className="flex flex-wrap gap-2">
          {PRODUCT_TINTS.map((name) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              aria-pressed={tint === name}
              onClick={() => setTint(name)}
              className={cn(
                "size-11 rounded-2xl ring-offset-2 ring-offset-surface",
                PRODUCT_TINT_CLASSES[name],
                tint === name && "ring-2 ring-ring",
              )}
            />
          ))}
        </div>
      </fieldset>
      <Status msg={msg} />
      <Button className="rounded-full" disabled={pending || !nameMn.trim()} onClick={save}>
        {t.save}
      </Button>
    </section>
  );
}
