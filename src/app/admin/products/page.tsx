import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ProductIcon } from "@/components/readings/product-icon";
import { formatMnt, mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import { contentCoverage } from "@/server/admin/content";
import { requireOwner } from "@/server/admin/guard";
import { db } from "@/server/db";
import { loadProductDefs } from "@/server/products";
import { CreateProductForm } from "./create-product-form";

export const metadata: Metadata = { title: mn.admin.nav.products };

const t = mn.admin.productsPage;

/** Owner only (SPEC §6.2): the catalogue, and a new product. Details at /admin/products/[code]. */
export default async function ProductsPage() {
  await requireOwner();
  const [products, coverage] = await Promise.all([loadProductDefs(db), contentCoverage(db)]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-4xl leading-none font-semibold">{t.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.intro}</p>
      </div>
      <CreateProductForm />
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => {
          const rows = coverage.filter((c) => c.product === p.code);
          const expected = rows.reduce((n, c) => n + c.expected, 0);
          const done = rows.reduce((n, c) => n + c.published - c.placeholder, 0);
          const fieldCount = p.parts.reduce(
            (n, part) => n + part.fields.filter((f) => !f.archivedAt).length,
            0,
          );
          return (
            <li key={p.code}>
              <Link
                href={`/admin/products/${p.code}`}
                className="flex h-full flex-col gap-4 rounded-3xl bg-surface p-5 hover:ring-2 hover:ring-border"
              >
                <div className="flex items-start gap-3">
                  <ProductIcon product={p} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-2 text-lg leading-tight font-semibold">
                      {p.nameMn}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold",
                      p.isActive ? "bg-tint-1 text-highlight" : "bg-subtle text-muted-foreground",
                    )}
                  >
                    {p.isActive ? t.active : t.inactive}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <Tag>{formatMnt(p.price)}</Tag>
                  <Tag>{t.persons(p.personCount)}</Tag>
                  {p.adultOnly && <Tag>18+</Tag>}
                  {p.parts.map((part) => (
                    <Tag key={part.code}>
                      {mn.admin.keyTypes[part.keyType]}
                      {part.byGender && " · ♂♀"}
                    </Tag>
                  ))}
                  <Tag>
                    {t.fields}: {fieldCount}
                  </Tag>
                </div>
                <div className="mt-auto flex items-center justify-between text-sm">
                  <span className="text-muted-foreground tabular-nums">
                    {t.coverage}: {done.toLocaleString("en-US")}/{expected.toLocaleString("en-US")}
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-subtle px-2.5 py-1 font-medium">{children}</span>;
}
