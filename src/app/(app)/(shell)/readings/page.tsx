import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageTitle } from "@/components/app/empty-state";
import { PriceAction } from "@/components/readings/price-action";
import { ProductIcon } from "@/components/readings/product-icon";
import { mn } from "@/i18n/mn";
import { formatDate } from "@/lib/birth-date";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current";
import {
  listActiveProducts,
  loadViewer,
  productsByCode,
  viewerIsAdult,
  type Product,
} from "@/server/catalog";
import { db } from "@/server/db";
import { listPurchases } from "@/server/purchase";
import { linkedPairReadings, readingNames } from "@/server/reading";

export async function generateMetadata({ searchParams }: PageProps<"/readings">): Promise<Metadata> {
  return { title: (await searchParams).tab === "mine" ? mn.readings.mine : mn.readings.catalogTitle };
}

export default async function ReadingsPage({ searchParams }: PageProps<"/readings">) {
  const { tab, product } = await searchParams;
  const { user } = await requireOnboardedUser();
  const t = mn.readings;
  const mine = tab === "mine";

  const [products, viewer] = await Promise.all([listActiveProducts(db), loadViewer(db, user.id)]);
  const visible = products.filter((p) => !p.adultOnly || viewerIsAdult(viewer));

  return (
    <div className="flex flex-col gap-5">
      <PageTitle>{t.title}</PageTitle>
      <div role="tablist" className="flex self-start rounded-full bg-surface p-1">
        {[
          { key: "catalog", label: t.catalog, href: "/readings" },
          { key: "mine", label: t.mine, href: "/readings?tab=mine" },
        ].map((x) => {
          const active = (x.key === "mine") === mine;
          return (
            <Link
              key={x.key}
              href={x.href}
              role="tab"
              aria-selected={active}
              className={cn(
                "flex h-11 items-center rounded-full px-5 text-sm font-semibold",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {x.label}
            </Link>
          );
        })}
      </div>

      {!mine ? (
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => (
            <li key={p.code}>
              <Link
                href={`/buy/${p.code}`}
                className="flex h-full flex-col gap-3 rounded-3xl bg-surface p-5 hover:ring-2 hover:ring-border"
              >
                <div className="flex items-start justify-between gap-3">
                  <ProductIcon product={p} className="size-12" />
                  <span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-semibold">
                    {p.adultOnly ? t.adult : p.personCount === 2 ? t.pair : t.single}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-lg font-semibold">{p.nameMn}</span>
                  <span className="text-sm text-muted-foreground">{p.description}</span>
                </div>
                <PriceAction price={p.price} label={t.choose} className="mt-auto" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <MyReadings
          userId={user.id}
          product={typeof product === "string" ? product : undefined}
          catalog={await productsByCode(db)}
        />
      )}
    </div>
  );
}

async function MyReadings({
  userId,
  product,
  catalog,
}: {
  userId: string;
  product?: string;
  catalog: Map<string, Product>;
}) {
  const t = mn.readings;
  const [all, linked] = await Promise.all([
    listPurchases(db, userId),
    linkedPairReadings(db, userId),
  ]);
  const list = product ? all.filter((p) => p.productCode === product) : all;
  const names = await readingNames(db, userId, list);
  const codes = [...new Set(all.map((p) => p.productCode))];

  if (all.length === 0 && linked.length === 0) {
    return (
      <p className="rounded-3xl bg-surface p-8 text-center text-muted-foreground">{t.mineEmpty}</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {codes.length > 1 && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto">
          <FilterChip href="/readings?tab=mine" active={!product}>
            {t.all}
          </FilterChip>
          {codes.map((c) => (
            <FilterChip key={c} href={`/readings?tab=mine&product=${c}`} active={product === c}>
              {catalog.get(c)?.nameMn ?? c}
            </FilterChip>
          ))}
        </div>
      )}
      <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        {list.map((p) => (
          <li key={p.id}>
            <Link
              href={`/r/${p.id}`}
              className="flex items-center gap-4 rounded-3xl bg-surface p-4 hover:ring-2 hover:ring-border"
            >
              <ProductIcon
                product={catalog.get(p.productCode)}
                pair={catalog.get(p.productCode)?.personCount === 2}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">
                  {catalog.get(p.productCode)?.nameMn ?? p.productCode}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {names.get(p.id)?.join(" × ")} · {formatDate(p.createdAt)}
                </span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {linked.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{t.linkedTitle}</h2>
          <ul className="flex flex-col gap-2">
            {linked.map(({ id, productCode }) => (
              <li key={id}>
                <Link
                  href={`/r/${id}`}
                  className="flex items-center gap-4 rounded-3xl bg-surface p-4"
                >
                  <ProductIcon product={catalog.get(productCode)} pair />
                  <span className="font-semibold">
                    {catalog.get(productCode)?.nameMn ?? productCode}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap",
        active ? "bg-primary text-primary-foreground" : "bg-surface",
      )}
    >
      {children}
    </Link>
  );
}
