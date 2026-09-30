import type { Metadata } from "next";

import { mn } from "@/i18n/mn";
import { listProducts } from "@/server/admin/catalog";
import { requireOwner } from "@/server/admin/guard";
import { db } from "@/server/db";
import { ProductForm } from "./product-form";

export const metadata: Metadata = { title: mn.admin.nav.products };

/** Owner only (SPEC §6.2): price, active, allowed groups, 18+. */
export default async function ProductsPage() {
  await requireOwner();
  const products = await listProducts(db);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[40px] leading-none font-semibold">{mn.admin.productsPage.title}</h1>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => (
          <ProductForm
            key={p.code}
            product={{
              code: p.code,
              nameMn: p.nameMn,
              price: p.price,
              isActive: p.isActive,
              adultOnly: p.adultOnly,
              allowedGroups: p.allowedGroups,
              personCount: p.personCount,
            }}
          />
        ))}
      </div>
    </div>
  );
}
