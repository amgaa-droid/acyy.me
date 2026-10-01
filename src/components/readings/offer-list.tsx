import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { ProductIcon } from "@/components/readings/product-icon";
import { formatMnt, mn } from "@/i18n/mn";

export type Offer = {
  code: string;
  name: string;
  icon: string;
  tint: string;
  price: number;
  personCount: number;
  purchaseId: string | null;
};

/** Products available for one person; bought ones read "Унших". */
export function OfferList({ personId, offers }: { personId: string; offers: Offer[] }) {
  return (
    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {offers.map((o) => {
        const href = o.purchaseId ? `/r/${o.purchaseId}` : `/buy/${o.code}?a=${personId}`;
        return (
          <li key={o.code}>
            <Link
              href={href}
              className="flex items-center gap-3 rounded-3xl bg-surface p-3.5 hover:ring-2 hover:ring-border"
            >
              <ProductIcon product={o} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">
                  {o.code === "synastry" ? mn.people.compare : o.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {o.purchaseId ? (
                    <span className="font-semibold text-highlight">{mn.readings.read}</span>
                  ) : (
                    formatMnt(o.price)
                  )}
                </span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
