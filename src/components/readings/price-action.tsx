import { ArrowRight } from "lucide-react";

import { formatMnt } from "@/i18n/mn";
import { cn } from "@/lib/utils";

/**
 * The foot of a product card: the price, and the dark "go" pill. One look for the landing
 * page and the catalogue (the card around it is the link).
 */
export function PriceAction({
  price,
  label,
  className,
}: {
  price: number;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-11 items-center justify-between rounded-full bg-subtle pr-2 pl-4 text-sm font-semibold",
        className,
      )}
    >
      {formatMnt(price)}
      <span className="flex items-center gap-1 rounded-full bg-fg px-3.5 py-1.5 text-bg">
        {label} <ArrowRight className="size-3.5" aria-hidden />
      </span>
    </span>
  );
}
