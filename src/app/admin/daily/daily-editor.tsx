"use client";

import { Copy, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { PRODUCT_ICON_COMPONENTS, PRODUCT_TINT_CLASSES } from "@/components/readings/product-icon";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { PRODUCT_ICONS, PRODUCT_TINTS, type ProductIconName, type ProductTint } from "@/lib/domain";
import { cn } from "@/lib/utils";
import type { DailyKind } from "@/server/daily";
import { Field, Status, Toggle, inputClass, toCode, type Msg } from "../products/ui";
import {
  createDailyKindAction,
  saveDailyTextsAction,
  updateDailyKindAction,
  type DailyResult,
} from "./actions";

const t = mn.admin.daily;

const errorMsg = (res: DailyResult): Msg =>
  res.ok ? null : { ok: false, text: t.errors[res.error] ?? t.errors.generic };

type Sign = { code: string; name: string; range: string };

/** One day × one kind: a text box per sign. Saves only the signs that changed. */
export function DailyEditor({
  date,
  heading,
  kind,
  max,
  signs,
  initial,
  previous,
}: {
  date: string;
  heading: string;
  kind: string;
  max: number;
  signs: Sign[];
  initial: Record<string, string>;
  previous: Record<string, string>;
}) {
  const router = useRouter();
  const [base, setBase] = useState(initial);
  const [texts, setTexts] = useState(initial);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, startTransition] = useTransition();

  const changed = signs.filter((s) => (texts[s.code] ?? "").trim() !== (base[s.code] ?? "").trim());
  const dirty = changed.length > 0;
  const filled = signs.filter((s) => (texts[s.code] ?? "").trim()).length;
  const canCopy = signs.some((s) => !(texts[s.code] ?? "").trim() && previous[s.code]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = t.leaveWarning;
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = () =>
    startTransition(async () => {
      const payload = Object.fromEntries(changed.map((s) => [s.code, texts[s.code] ?? ""]));
      const res = await saveDailyTextsAction({ date, kind, texts: payload });
      if (!res.ok) return setMsg(errorMsg(res));
      const next = Object.fromEntries(
        Object.entries({ ...base, ...payload })
          .map(([k, v]) => [k, v.trim()])
          .filter(([, v]) => v),
      );
      setBase(next);
      setTexts(next);
      setMsg({ ok: true, text: t.saved(res.saved ?? 0, res.cleared ?? 0) });
      router.refresh();
    });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-semibold">{heading}</h2>
          <p className="text-sm text-muted-foreground tabular-nums">{t.filled(filled)}</p>
        </div>
        <Button
          variant="outline"
          className="rounded-full"
          disabled={!canCopy}
          aria-describedby="daily-copy-hint"
          onClick={() =>
            setTexts((cur) => {
              const next = { ...cur };
              for (const s of signs)
                if (!(next[s.code] ?? "").trim() && previous[s.code])
                  next[s.code] = previous[s.code];
              return next;
            })
          }
        >
          <Copy aria-hidden /> {t.copyPrev}
        </Button>
        <span id="daily-copy-hint" className="sr-only">
          {canCopy ? t.copyPrevHint : t.copyPrevNone}
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {signs.map((s) => {
          const value = texts[s.code] ?? "";
          const edited = value.trim() !== (base[s.code] ?? "").trim();
          return (
            <li
              key={s.code}
              className={cn(
                "flex flex-col gap-2 rounded-3xl bg-surface p-4",
                edited && "ring-2 ring-highlight/40",
              )}
            >
              <label
                htmlFor={`daily-${s.code}`}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="font-semibold">{s.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{s.range}</span>
              </label>
              <textarea
                id={`daily-${s.code}`}
                aria-label={s.name}
                value={value}
                maxLength={max}
                rows={6}
                placeholder={t.placeholder}
                onChange={(e) => setTexts((cur) => ({ ...cur, [s.code]: e.target.value }))}
                className="min-h-36 w-full resize-y rounded-2xl bg-subtle px-3.5 py-3 text-base leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="self-end text-xs text-muted-foreground tabular-nums">
                {t.chars(value.length, max)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 bg-bg/90 px-4 py-3 backdrop-blur lg:-mx-10 lg:px-10">
        <Button className="rounded-full lg:w-48" disabled={pending || !dirty} onClick={save}>
          {pending ? t.saving : t.save}
        </Button>
        {dirty && !pending && <span className="text-sm text-muted-foreground">{t.dirty}</span>}
        <Status msg={msg} />
      </div>
    </section>
  );
}

type KindDraft = {
  nameMn: string;
  icon: ProductIconName;
  tint: ProductTint;
  sort: string;
  isActive: boolean;
};

function KindInputs({ draft, set }: { draft: KindDraft; set: (d: KindDraft) => void }) {
  return (
    <>
      <div className="grid grid-cols-[1fr_88px] gap-3">
        <Field label={t.name}>
          <input
            className={inputClass}
            value={draft.nameMn}
            maxLength={60}
            onChange={(e) => set({ ...draft, nameMn: e.target.value })}
          />
        </Field>
        <Field label={t.sort}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={draft.sort}
            onChange={(e) => set({ ...draft, sort: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{t.icon}</legend>
        <div className="flex flex-wrap gap-1.5">
          {PRODUCT_ICONS.map((name) => {
            const Icon = PRODUCT_ICON_COMPONENTS[name];
            return (
              <button
                key={name}
                type="button"
                aria-label={name}
                aria-pressed={draft.icon === name}
                onClick={() => set({ ...draft, icon: name })}
                className={cn(
                  "flex size-10 items-center justify-center rounded-2xl",
                  draft.icon === name ? "bg-primary text-primary-foreground" : "bg-subtle",
                )}
              >
                <Icon className="size-4.5" aria-hidden />
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{t.tint}</legend>
        <div className="flex flex-wrap gap-2">
          {PRODUCT_TINTS.map((name) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              aria-pressed={draft.tint === name}
              onClick={() => set({ ...draft, tint: name })}
              className={cn(
                "size-10 rounded-2xl ring-offset-2 ring-offset-surface",
                PRODUCT_TINT_CLASSES[name],
                draft.tint === name && "ring-2 ring-ring",
              )}
            />
          ))}
        </div>
      </fieldset>
    </>
  );
}

const kindPayload = (d: KindDraft) => ({
  nameMn: d.nameMn,
  icon: d.icon,
  tint: d.tint,
  sort: Number(d.sort || 0),
});

function KindCard({ kind }: { kind: DailyKind }) {
  const router = useRouter();
  const [draft, setDraft] = useState<KindDraft>({
    nameMn: kind.nameMn,
    icon: kind.icon as ProductIconName,
    tint: kind.tint as ProductTint,
    sort: String(kind.sort),
    isActive: kind.isActive,
  });
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, startTransition] = useTransition();
  const Icon = PRODUCT_ICON_COMPONENTS[draft.icon];

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-4 rounded-3xl bg-surface p-5",
        !kind.isActive && "opacity-75",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-full",
            PRODUCT_TINT_CLASSES[draft.tint],
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="font-mono text-xs text-muted-foreground">{kind.code}</span>
      </div>
      <KindInputs draft={draft} set={setDraft} />
      <Toggle
        label={draft.isActive ? t.active : t.off}
        on={draft.isActive}
        onChange={(v) => setDraft({ ...draft, isActive: v })}
      />
      <Status msg={msg} />
      <Button
        className="mt-auto rounded-full"
        disabled={pending || !draft.nameMn.trim()}
        onClick={() =>
          startTransition(async () => {
            const res = await updateDailyKindAction({
              code: kind.code,
              ...kindPayload(draft),
              isActive: draft.isActive,
            });
            setMsg(res.ok ? { ok: true, text: t.kindSaved } : errorMsg(res));
            if (res.ok) router.refresh();
          })
        }
      >
        {t.save}
      </Button>
    </div>
  );
}

function NewKind({ nextSort }: { nextSort: number }) {
  const router = useRouter();
  const empty: KindDraft = {
    nameMn: "",
    icon: "star",
    tint: "tint-1",
    sort: String(nextSort),
    isActive: true,
  };
  const [code, setCode] = useState("");
  const [draft, setDraft] = useState<KindDraft>(empty);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, startTransition] = useTransition();

  return (
    <details className="rounded-3xl bg-surface p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
        <Plus className="size-5" aria-hidden /> {t.newKind}
      </summary>
      <div className="mt-4 flex flex-col gap-4 lg:max-w-xl">
        <Field label={t.code}>
          <input
            className={inputClass}
            value={code}
            onChange={(e) => setCode(toCode(e.target.value))}
            placeholder="money"
          />
        </Field>
        <KindInputs draft={draft} set={setDraft} />
        <Status msg={msg} />
        <Button
          className="rounded-full lg:w-48"
          disabled={pending || code.length < 2 || !draft.nameMn.trim()}
          onClick={() =>
            startTransition(async () => {
              const res = await createDailyKindAction({ code, ...kindPayload(draft) });
              setMsg(res.ok ? { ok: true, text: t.kindCreated } : errorMsg(res));
              if (res.ok) {
                setCode("");
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

/** Owner: which daily horoscopes exist, their names, look and order. */
export function KindsManager({ kinds }: { kinds: DailyKind[] }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold">{t.kinds}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.kindsHint}</p>
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {kinds.map((k) => (
          <li key={k.code}>
            <KindCard kind={k} />
          </li>
        ))}
      </ul>
      <NewKind nextSort={Math.max(0, ...kinds.map((k) => k.sort)) + 1} />
    </section>
  );
}
