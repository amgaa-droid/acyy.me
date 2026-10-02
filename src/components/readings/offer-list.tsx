import { ArrowRight, Check, ChevronRight, Lock } from "lucide-react";
import Link from "next/link";

import { ProductIcon } from "@/components/readings/product-icon";
import { formatMnt, mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";

export type Offer = {
  code: string;
  name: string;
  icon: string;
  tint: string;
  price: number;
  personCount: number;
  purchaseId: string | null;
};

/**
 * Products available for one person. Bought ones are tinted, keep their own icon colour
 * and read "Унших"; unbought ones have a grey icon, a padlock by the price and the same dark
 * "go" mark as the catalogue cards.
 */
export function OfferList({ personId, offers }: { personId: string; offers: Offer[] }) {
  return (
    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {offers.map((o) => {
        const bought = o.purchaseId !== null;
        const href = bought ? `/r/${o.purchaseId}` : `/buy/${o.code}?a=${personId}&from=p`;
        return (
          <li key={o.code}>
            <Link
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-3xl p-3.5",
                bought
                  ? "bg-highlight/12 ring-1 ring-highlight/45 ring-inset hover:ring-2"
                  : "bg-surface hover:ring-2 hover:ring-border",
              )}
            >
              <ProductIcon product={o} muted={!bought} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="leading-tight font-semibold text-balance">{o.name}</span>
                {bought ? (
                  <span className="flex items-center gap-1 text-sm font-semibold text-highlight">
                    <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                    {mn.readings.read}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Lock className="size-3.5" aria-label={mn.readings.locked} />
                    {formatMnt(o.price)}
                  </span>
                )}
              </span>
              {bought ? (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-highlight text-highlight-fg">
                  <ChevronRight className="size-4.5" strokeWidth={2.5} aria-hidden />
                </span>
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fg text-bg">
                  <ArrowRight className="size-4" aria-hidden />
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
