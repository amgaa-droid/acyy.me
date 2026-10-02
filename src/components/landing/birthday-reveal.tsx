"use client";

import { ArrowRight, Lock, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { revealAction } from "@/app/actions/reveal";
import { ConstellationArt } from "@/components/app/constellation";
import { Teaser } from "@/components/readings/reading-body";
import { formatMnt, mn } from "@/i18n/mn";
import type { LandingReveal } from "@/server/landing";

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

const selectClass =
  "h-13 w-full appearance-none rounded-2xl border border-border bg-surface px-4 text-base font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** Landing hook: pick a month/day → sign + free teaser of the birthday reading → buy CTA. */
export function BirthdayReveal({ price }: { price: number }) {
  const t = mn.landing.reveal;
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [reveal, setReveal] = useState<LandingReveal | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const maxDay = month ? DAYS_IN_MONTH[Number(month) - 1] : 31;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    startTransition(async () => {
      const res = await revealAction({ month, day });
      if (res.ok) setReveal(res.reveal);
      else setError(true);
    });
  };

  if (reveal) {
    return (
      <div className="flex flex-col gap-4 rounded-[32px] bg-surface p-5 lg:p-7">
        <div className="relative -mx-1 overflow-hidden rounded-3xl bg-tint-1 p-5">
          <ConstellationArt
            sign={reveal.sign.code}
            className="absolute -top-4 -right-8 size-40 opacity-90"
          />
          <span className="text-xs font-semibold tracking-widest text-highlight uppercase">
            {t.yourSign}
          </span>
          <p className="font-heading text-5xl leading-none font-semibold">{reveal.sign.nameMn}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-surface/70 px-3 py-1.5 text-xs font-medium">
              {reveal.sign.startMd.replace("-", ".")} – {reveal.sign.endMd.replace("-", ".")}
            </span>
            <span className="rounded-full bg-surface/70 px-3 py-1.5 text-xs font-medium">
              {t.period(reveal.period)}
            </span>
          </div>
        </div>

        {(reveal.title || reveal.teaser || reveal.excerpt) && (
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              {t.preview}
            </span>
            {reveal.title && (
              <h3 className="text-2xl leading-tight font-semibold">{reveal.title}</h3>
            )}
            {reveal.teaser && <Teaser text={reveal.teaser} />}
            {reveal.excerpt && <p className="text-base leading-relaxed">{reveal.excerpt}</p>}
            {/* Decorative placeholder lines — the real text is not on the page. */}
            <div aria-hidden className="flex flex-col gap-2.5 pt-1">
              {[100, 94, 97, 62].map((w) => (
                <div key={w} className="h-3 rounded-full bg-subtle" style={{ width: `${w}%` }} />
              ))}
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="size-4" aria-hidden /> {t.locked}
            </p>
          </div>
        )}

        <Link
          href="/login"
          className="flex h-13 items-center justify-center gap-2 rounded-full bg-fg px-5 text-base font-semibold text-bg"
        >
          {t.unlock} · {formatMnt(price)}
          <ArrowRight className="size-4.5" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => setReveal(null)}
          className="flex h-11 items-center justify-center gap-2 text-sm font-semibold text-muted-foreground"
        >
          <RotateCcw className="size-4" aria-hidden /> {t.again}
        </button>
        <p className="text-center text-xs text-muted-foreground">{t.gift}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-[32px] bg-surface p-5 lg:p-7">
      <span className="font-semibold">{t.title}</span>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{t.month}</span>
          <select
            required
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              const max = DAYS_IN_MONTH[Number(e.target.value) - 1];
              if (Number(day) > max) setDay(String(max));
            }}
            className={selectClass}
          >
            <option value="" disabled>
              —
            </option>
            {range(12).map((m) => (
              <option key={m} value={m}>
                {t.monthName(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{t.day}</span>
          <select
            required
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className={selectClass}
          >
            <option value="" disabled>
              —
            </option>
            {range(maxDay).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="text-sm text-destructive">{t.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 flex h-13 items-center justify-center gap-2 rounded-full bg-fg px-5 text-base font-semibold text-bg disabled:opacity-60"
      >
        {pending ? t.loading : t.submit}
        {!pending && <ArrowRight className="size-4.5" aria-hidden />}
      </button>
      <p className="text-center text-xs text-muted-foreground">{t.note}</p>
    </form>
  );
}
