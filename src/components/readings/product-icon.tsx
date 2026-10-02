import {
  Baby,
  Blend,
  Briefcase,
  CalendarDays,
  Coffee,
  Flame,
  Gem,
  Heart,
  Leaf,
  Moon,
  Sparkles,
  Star,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { ProductIconName, ProductTint } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const PRODUCT_ICON_COMPONENTS: Record<ProductIconName, LucideIcon> = {
  calendar: CalendarDays,
  sparkles: Sparkles,
  heart: Heart,
  flame: Flame,
  coffee: Coffee,
  blend: Blend,
  moon: Moon,
  sun: Sun,
  star: Star,
  gem: Gem,
  baby: Baby,
  briefcase: Briefcase,
  leaf: Leaf,
  users: Users,
};

export const PRODUCT_TINT_CLASSES: Record<ProductTint, string> = {
  highlight: "bg-highlight text-highlight-fg",
  "tint-1": "bg-tint-1 text-highlight",
  "tint-2": "bg-tint-2 text-fg",
  "tint-3": "bg-tint-3 text-fg",
  dark: "bg-fg text-bg",
  nav: "bg-nav text-nav-active",
};

export type ProductLook = { icon: string; tint: string };

/** Pastel icon tile per product (cosmic-soft design); icon and colour are set in /admin/products. */
export function ProductIcon({
  product,
  muted = false,
  pair = false,
  className,
}: {
  product: ProductLook | null | undefined;
  /** Grey, colourless tile for a product the viewer hasn't bought. */
  muted?: boolean;
  /** A bought pair reading: the orange of its link on home, whatever the product's own tint. */
  pair?: boolean;
  className?: string;
}) {
  const Icon = PRODUCT_ICON_COMPONENTS[product?.icon as ProductIconName] ?? Sparkles;
  const tile = PRODUCT_TINT_CLASSES[product?.tint as ProductTint] ?? PRODUCT_TINT_CLASSES["tint-1"];
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-2xl",
        muted ? "bg-subtle text-muted-foreground" : pair ? "bg-pair text-pair-fg" : tile,
        className,
      )}
    >
      <Icon className="size-5" strokeWidth={1.75} aria-hidden />
    </span>
  );
}
