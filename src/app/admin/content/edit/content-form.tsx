"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import { firstSentences } from "@/lib/preview";
import { saveContentAction } from "../../actions";

const t = mn.admin.content;

type Props = {
  target: { product: string; section: string; key: string };
  initial: { title: string; body: string; score: number | null; status: "draft" | "published" };
  showScore: boolean;
};

export function ContentForm({ target, initial, showScore }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [score, setScore] = useState(initial.score === null ? "" : String(initial.score));
  const [status, setStatus] = useState(initial.status);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setMsg(null);
      const res = await saveContentAction({ ...target, title, body, score, status });
      if (res.ok) {
        setMsg({ ok: true, text: t.saved });
        router.replace(`/admin/content/edit?id=${res.id}`);
        router.refresh();
      } else setMsg({ ok: false, text: t.errors[res.error] });
    });

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
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t.fieldBody}
        <textarea
          className={cn(input, "min-h-72 py-3 text-base leading-relaxed")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
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
        <p className="mt-1 text-sm leading-relaxed">{firstSentences(body, 2) || "—"}</p>
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
        disabled={pending || !title.trim() || !body.trim()}
        onClick={save}
      >
        {t.save}
      </Button>
    </div>
  );
}
