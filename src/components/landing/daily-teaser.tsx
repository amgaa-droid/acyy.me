"use client";

import { ArrowRight, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ConstellationArt } from "@/components/app/constellation";
import { PRODUCT_ICON_COMPONENTS, PRODUCT_TINT_CLASSES } from "@/components/readings/product-icon";
import { mn } from "@/i18n/mn";
import type { ProductIconName, ProductTint } from "@/lib/domain";
import type { LandingContent } from "@/lib/landing-content";
import { cn } from "@/lib/utils";
import type { LandingDaily } from "@/server/landing-daily";

/**
 * Landing section: pick a sign → the first sentences of today's free daily horoscope, the other
 * daily kinds named, and a sign-up CTA (the full texts live on the signed-in home).
 */
export function DailyTeaser({
  copy,
  data,
}: {
  copy: LandingContent["daily"];
  data: LandingDaily;
}) {
  const [sign, setSign] = useState(data.todaySign);
  const rowRef = useRef<HTMLDivElement>(null);

  // Phone: the chips scroll sideways — bring today's sign into view (without moving the page).
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (row && chip) row.scrollLeft = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
  }, []);
  const excerpt = data.excerpts[sign];
  const [first, ...others] = data.kinds;
  const signName = data.signs.find((s) => s.code === sign)?.name ?? "";

  return (
    <section className="grid min-w-0 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
      <div className="flex min-w-0 flex-col gap-3">
        {copy.eyebrow && (
          <span className="flex w-fit items-center gap-1.5 rounded-full bg-tint-3 px-3 py-1.5 text-xs font-semibold">
            <Sparkles className="size-3.5" aria-hidden /> {copy.eyebrow}
          </span>
        )}
        <h2 className="font-heading text-[34px] leading-tight font-semibold text-balance lg:text-5xl">
          {copy.title}
        </h2>
        {copy.body && <p className="text-muted-foreground lg:text-lg">{copy.body}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          {data.kinds.map((k) => (
            <span
              key={k.code}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold",
                PRODUCT_TINT_CLASSES[k.tint as ProductTint] ?? PRODUCT_TINT_CLASSES["tint-1"],
              )}
            >
              <KindIcon icon={k.icon} className="size-4" /> {k.name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 rounded-[32px] bg-surface p-5 lg:p-7">
        <span className="text-sm font-semibold">{copy.pickSign}</span>
        <div
          ref={rowRef}
          role="radiogroup"
          aria-label={copy.pickSign}
          className="relative -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible"
        >
          {data.signs.map((s) => (
            <button
              key={s.code}
              type="button"
              role="radio"
              aria-checked={sign === s.code}
              onClick={() => setSign(s.code)}
              className={cn(
                "h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors",
                sign === s.code ? "bg-fg text-bg" : "bg-subtle",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>

        <article className="relative overflow-hidden rounded-3xl bg-tint-1 p-5">
          <ConstellationArt
            sign={sign}
            rings={false}
            className="pointer-events-none absolute -top-4 -right-6 size-32 opacity-40"
          />
          <p className="relative text-xs font-semibold tracking-widest text-highlight uppercase">
            {data.dayLabel}
          </p>
          {first && (
            <h3 className="relative mt-1 flex items-center gap-2 font-heading text-2xl font-semibold">
              {signName} · {first.name}
            </h3>
          )}
          <p aria-live="polite" className="relative mt-3 text-base leading-relaxed">
            {excerpt ?? <span className="text-muted-foreground">{copy.empty}</span>}
          </p>
          {excerpt && (
            <div aria-hidden className="relative mt-3 flex flex-col gap-2">
              {[96, 88, 58].map((w) => (
                <div key={w} className="h-2.5 rounded-full bg-surface/70" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}
        </article>

        {others.length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="size-3.5" aria-hidden /> {copy.more}
            {others.map((k) => (
              <span key={k.code} className="font-semibold text-fg">
                {k.name}
              </span>
            ))}
          </p>
        )}
        <Link
          href="/login"
          className="flex h-13 items-center justify-center gap-2 rounded-full bg-fg px-6 text-base font-semibold text-bg"
        >
          {copy.cta} <ArrowRight className="size-4.5" aria-hidden />
        </Link>
        {copy.note && <p className="text-center text-xs text-muted-foreground">{copy.note}</p>}
        <p className="text-center text-[11px] text-muted-foreground">{mn.common.entertainmentOnly}</p>
      </div>
    </section>
  );
}

function KindIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = PRODUCT_ICON_COMPONENTS[icon as ProductIconName] ?? Sparkles;
  return <Icon className={className} strokeWidth={1.8} aria-hidden />;
}
