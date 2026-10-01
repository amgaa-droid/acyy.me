import { count, eq } from "drizzle-orm";
import { ChevronLeft, Download, FileSpreadsheet, Text } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductIcon } from "@/components/readings/product-icon";
import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import { fieldUsage, partTextCounts } from "@/server/admin/catalog";
import { productCoverage } from "@/server/admin/content";
import { requireOwner } from "@/server/admin/guard";
import { db } from "@/server/db";
import { purchases } from "@/server/db/schema";
import { kindFor } from "@/server/import/kinds";
import { loadProductDef } from "@/server/products";
import { ProductForm } from "../product-form";
import { DeleteProduct } from "./delete-product";
import { PartsEditor } from "./parts-editor";

export const metadata: Metadata = { title: mn.admin.nav.products };

const t = mn.admin.productsPage;

/** One product: settings, coverage per part, and its parts / sub-sections (Owner only). */
export default async function ProductPage({ params }: PageProps<"/admin/products/[code]">) {
  await requireOwner();
  const { code } = await params;
  const product = await loadProductDef(db, code);
  if (!product) notFound();

  const [coverage, [{ sales }], partStats] = await Promise.all([
    productCoverage(db, code),
    db.select({ sales: count() }).from(purchases).where(eq(purchases.productCode, code)),
    Promise.all(
      product.parts.map(async (p) => ({
        texts: await partTextCounts(db, code, p.code),
        usage: await fieldUsage(db, code, p.code),
      })),
    ),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/products"
        className="flex h-11 items-center gap-1 self-start rounded-full bg-surface pr-4 pl-2 text-sm font-semibold"
      >
        <ChevronLeft className="size-5" aria-hidden /> {t.back}
      </Link>
      <div className="flex items-center gap-4">
        <ProductIcon product={product} className="size-14" />
        <div className="flex min-w-0 flex-col">
          <h1 className="text-[34px] leading-none font-semibold lg:text-[40px]">
            {product.nameMn}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{product.code}</span> · {t.persons(product.personCount)} ·{" "}
            {t.sales(sales)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
        <ProductForm
          product={{
            code: product.code,
            nameMn: product.nameMn,
            description: product.description,
            price: product.price,
            isActive: product.isActive,
            adultOnly: product.adultOnly,
            allowedGroups: product.allowedGroups,
            sort: product.sort,
            icon: product.icon,
            tint: product.tint,
          }}
        />

        <div className="flex flex-col gap-5">
          <section
            className="flex flex-col gap-3 rounded-3xl bg-surface p-5"
            aria-label={t.coverage}
          >
            <h2 className="text-xl font-semibold">{t.coverage}</h2>
            {coverage.map((c) => {
              const done = c.published - c.placeholder;
              const pct = c.expected ? Math.round((done / c.expected) * 100) : 0;
              const kind = kindFor(product, c.section);
              return (
                <div key={c.section} className="flex flex-col gap-2 rounded-2xl bg-subtle/60 p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      {product.parts.find((p) => p.code === c.section)?.nameMn}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {done.toLocaleString("en-US")}/{c.expected.toLocaleString("en-US")}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-subtle" aria-hidden>
                    <div
                      className={cn(
                        "h-full rounded-full",
                        pct === 100 ? "bg-highlight" : "bg-ring-2",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1 text-sm">
                    <LinkChip href={`/admin/content?product=${product.code}&section=${c.section}`}>
                      <Text aria-hidden /> {t.openContent}
                    </LinkChip>
                    <LinkChip href={`/api/admin/templates/${kind}`} download>
                      <Download aria-hidden /> {t.template}
                    </LinkChip>
                    <LinkChip href={`/admin/import?kind=${encodeURIComponent(kind)}`}>
                      <FileSpreadsheet aria-hidden /> {mn.admin.nav.import}
                    </LinkChip>
                  </div>
                </div>
              );
            })}
          </section>

          <PartsEditor
            productCode={product.code}
            personCount={product.personCount}
            hasPurchases={sales > 0}
            parts={product.parts.map((p, i) => ({
              code: p.code,
              nameMn: p.nameMn,
              keyType: p.keyType,
              byGender: p.byGender,
              archived: p.archivedAt !== null,
              realTexts: partStats[i].texts.real,
              placeholders: partStats[i].texts.placeholder,
              fields: p.fields.map((f) => ({
                code: f.code,
                nameMn: f.nameMn,
                kind: f.kind,
                isFree: f.isFree,
                required: f.required,
                archived: f.archivedAt !== null,
                used: partStats[i].usage[f.code] ?? 0,
              })),
            }))}
          />

          {sales === 0 && <DeleteProduct code={product.code} />}
        </div>
      </div>
    </div>
  );
}

function LinkChip({
  href,
  download,
  children,
}: {
  href: string;
  download?: boolean;
  children: React.ReactNode;
}) {
  const cls =
    "flex h-11 items-center gap-2 rounded-full bg-surface px-4 font-semibold hover:ring-2 hover:ring-border [&_svg]:size-4";
  return download ? (
    <a href={href} className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
