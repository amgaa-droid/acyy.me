"use client";

import { useState } from "react";

import { formatMnt } from "@/i18n/mn";
import { cn } from "@/lib/utils";

/**
 * Single-series column chart (one per measure — small multiples, never two scales on one
 * axis). Hover/focus a column for its label and value; the total is in the title row.
 */
export function ColumnChart({
  title,
  points,
}: {
  title: string;
  points: { label: string; value: number }[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((n, p) => n + p.value, 0);
  const shown = active === null ? null : points[active];

  return (
    <figure className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {shown ? `${shown.label} · ${formatMnt(shown.value)}` : formatMnt(total)}
        </span>
      </figcaption>
      <div
        className="flex h-32 items-end gap-0.5 border-b border-border"
        onMouseLeave={() => setActive(null)}
      >
        {points.map((p, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${p.label}: ${formatMnt(p.value)}`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="group flex h-full min-w-0 flex-1 items-end outline-none"
          >
            <span
              className={cn(
                "w-full rounded-t-[4px] transition-opacity",
                p.value > 0 ? "bg-highlight" : "bg-transparent",
                active !== null && active !== i && "opacity-40",
              )}
              style={{ height: p.value > 0 ? `max(2px, ${(p.value / max) * 100}%)` : 0 }}
            />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{points[0]?.label}</span>
        <span>{points.at(-1)?.label}</span>
      </div>
    </figure>
  );
}
