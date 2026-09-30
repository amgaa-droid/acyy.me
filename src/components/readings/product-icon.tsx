import { Blend, CalendarDays, Coffee, Flame, Heart, Sparkles, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const ICONS: Record<string, { Icon: LucideIcon; tile: string }> = {
  birthday: { Icon: CalendarDays, tile: "bg-highlight text-highlight-fg" },
  sign: { Icon: Sparkles, tile: "bg-tint-1 text-highlight" },
  love: { Icon: Heart, tile: "bg-tint-2 text-fg" },
  sex: { Icon: Flame, tile: "bg-fg text-bg" },
  dating: { Icon: Coffee, tile: "bg-tint-3 text-fg" },
  synastry: { Icon: Blend, tile: "bg-nav text-nav-active" },
};

/** Pastel icon tile per product (cosmic-soft design). */
export function ProductIcon({ code, className }: { code: string; className?: string }) {
  const { Icon, tile } = ICONS[code] ?? ICONS.sign;
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-2xl",
        tile,
        className,
      )}
    >
      <Icon className="size-5.5" strokeWidth={1.7} aria-hidden />
    </span>
  );
}
