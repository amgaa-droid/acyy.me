import { Sparkle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

const STARS = [
  { top: "18%", left: "62%", size: 3, delay: "0s" },
  { top: "70%", left: "78%", size: 2, delay: "1.2s" },
  { top: "30%", left: "88%", size: 4, delay: "0.6s" },
  { top: "78%", left: "52%", size: 2, delay: "2s" },
  { top: "12%", left: "40%", size: 2, delay: "2.6s" },
];

/**
 * The highlight of a reading — "Тохиромжтой харилцаа": a solid accent card with a glow and
 * twinkling stars. Shared by the summary (FeaturedRow) and the reveal overlay (CompatReveal) so the
 * card that flies down lands exactly on the real one.
 */
export function FeaturedCard({
  label,
  value,
  className,
  ...props
}: { label: ReactNode; value: ReactNode } & ComponentProps<"section">) {
  return (
    <section
      {...props}
      className={cn(
        "relative isolate overflow-hidden rounded-3xl bg-highlight px-5 py-5.5 text-highlight-fg lg:rounded-[28px] lg:px-6 lg:py-6.5",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute -top-16 -right-10 -z-10 size-48 animate-reveal-glow rounded-full bg-highlight-fg/15 blur-2xl"
      />
      <span
        aria-hidden
        className="absolute -bottom-20 -left-12 -z-10 size-40 rounded-full bg-pair/25 blur-3xl"
      />
      {STARS.map((s) => (
        <span
          key={s.top + s.left}
          aria-hidden
          className="absolute -z-10 animate-twinkle rounded-full bg-highlight-fg"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: s.delay }}
        />
      ))}
      <div className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-highlight-fg/15 ring-1 ring-highlight-fg/25 lg:size-13">
          <Sparkle className="size-5 fill-current" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-sans text-[11px] font-semibold tracking-[0.14em] text-highlight-fg/75 uppercase">
            {label}
          </h3>
          <p className="font-serif text-[34px] leading-[1.05] font-semibold lg:text-[38px]">
            {value}
          </p>
        </div>
      </div>
    </section>
  );
}
