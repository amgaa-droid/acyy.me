"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import type { FieldKind } from "@/lib/domain";
import { fieldItems, isItemKind } from "@/lib/fields";
import { cn } from "@/lib/utils";
import { firstSentences } from "@/lib/preview";
import { saveContentAction } from "../../actions";

const t = mn.admin.content;

export type FormField = {
  code: string;
  name: string;
  kind: FieldKind;
  isFree: boolean;
  required: boolean;
};

type Props = {
  target: { product: string; section: string; key: string };
  fields: FormField[];
  initial: {
    title: string;
    fields: Record<string, string>;
    teaser: string;
    score: number | null;
    status: "draft" | "published";
  };
  showScore: boolean;
};

export function ContentForm({ target, fields, initial, showScore }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.code, initial.fields[f.code] ?? ""])),
  );
  const [teaser, setTeaser] = useState(initial.teaser);
  const [score, setScore] = useState(initial.score === null ? "" : String(initial.score));
  const [status, setStatus] = useState(initial.status);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setMsg(null);
      const res = await saveContentAction({
        ...target,
        title,
        fields: values,
        teaser,
        score,
        status,
      });
      if (res.ok) {
        setMsg({ ok: true, text: t.saved });
        router.replace(`/admin/content/edit?id=${res.id}`);
        router.refresh();
      } else setMsg({ ok: false, text: t.errors[res.error] });
    });

  // Same rule as the server preview (src/server/reading.ts): first paid prose field, 2 sentences.
  const paid = fields.find(
    (f) => !f.isFree && (f.kind === "text" || f.kind === "quote") && values[f.code].trim(),
  );
  const excerpt = paid ? firstSentences(values[paid.code], 2) : "";
  const missingRequired = fields.some((f) => f.required && !values[f.code].trim());
  const empty = fields.every((f) => !values[f.code].trim());

  const input =
    "rounded-2xl bg-surface px-4 outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t.fieldTitle}
        <input
          className={cn(input, "h-12 text-base")}
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      {fields.map((f) => (
        <label key={f.code} className="flex flex-col gap-1.5 text-sm font-medium">
          <span className="flex flex-wrap items-center gap-2">
            {f.name}
            <span className="rounded-full bg-subtle px-2 py-0.5 text-xs font-normal text-muted-foreground">
              {mn.admin.fieldKinds[f.kind]}
            </span>
            {f.isFree && (
              <span className="rounded-full bg-tint-3 px-2 py-0.5 text-xs">{t.free}</span>
            )}
            {f.required && <span className="text-destructive">*</span>}
          </span>
          <textarea
            className={cn(
              input,
              "py-3 text-base leading-relaxed",
              f.kind === "text" ? "min-h-56" : "min-h-28",
            )}
            value={values[f.code]}
            onChange={(e) => setValues((v) => ({ ...v, [f.code]: e.target.value }))}
          />
          <span className="text-xs font-normal text-muted-foreground">
            {isItemKind(f.kind) ? t.itemsHint : f.kind === "text" ? t.fieldBodyHint : null}
          </span>
        </label>
      ))}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t.fieldTeaser}
        <textarea
          className={cn(input, "min-h-24 py-3 text-base leading-relaxed")}
          value={teaser}
          maxLength={500}
          onChange={(e) => setTeaser(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-4">
        {showScore && (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t.fieldScore}
            <input
              className={cn(input, "h-12 w-32 text-base tabular-nums")}
              inputMode="numeric"
              value={score}
              onChange={(e) => setScore(e.target.value.replace(/\D/g, "").slice(0, 3))}
            />
          </label>
        )}
        <fieldset className="flex flex-col gap-1.5 text-sm font-medium">
          <legend className="mb-1.5">{t.fieldStatus}</legend>
          <div className="flex gap-2">
            {(["published", "draft"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
                className={cn(
                  "h-12 rounded-full px-4 font-semibold",
                  status === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface ring-1 ring-border",
                )}
              >
                {mn.admin.status[s]}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <section className="rounded-3xl bg-tint-1 p-5">
        <h2 className="text-xs font-semibold tracking-widest text-highlight uppercase">
          {t.preview}
        </h2>
        <p className="mt-2 font-heading text-2xl font-semibold">{title || "—"}</p>
        {teaser.trim() && (
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{teaser}</p>
        )}
        {fields
          .filter((f) => f.isFree && values[f.code].trim())
          .map((f) => (
            <p key={f.code} className="mt-2 text-sm">
              <span className="font-semibold">{f.name}: </span>
              {isItemKind(f.kind) ? fieldItems(values[f.code], f.kind).join(" · ") : values[f.code]}
            </p>
          ))}
        <p className="mt-1 text-sm leading-relaxed">{excerpt || "—"}</p>
      </section>

      {msg && (
        <p
          role="status"
          className={cn(
            "rounded-2xl px-4 py-3 text-sm",
            msg.ok ? "bg-tint-3" : "bg-destructive/10 text-destructive",
          )}
        >
          {msg.text}
        </p>
      )}
      <Button
        size="lg"
        className="rounded-full lg:w-48"
        disabled={pending || !title.trim() || missingRequired || empty}
        onClick={save}
      >
        {t.save}
      </Button>
    </div>
  );
}
