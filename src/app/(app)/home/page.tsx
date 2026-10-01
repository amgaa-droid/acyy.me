import { ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SignHero } from "@/components/app/sign-hero";
import { PersonTile } from "@/components/people/person-card";
import { ProductIcon } from "@/components/readings/product-icon";
import { formatMnt, mn } from "@/i18n/mn";
import { RELATION_GROUP } from "@/lib/domain";
import { relationText } from "@/lib/people";
import { describeBirthDate, loadAstroRefs } from "@/server/astro/refs";
import { requireOnboardedUser } from "@/server/auth/current";
import { loadViewer, offersForPerson, productsByCode } from "@/server/catalog";
import { db } from "@/server/db";
import { listPeopleWithSigns } from "@/server/people-view";
import { listPurchases, subjectKey } from "@/server/purchase";

export const metadata: Metadata = { title: mn.home.title };

export default async function HomePage() {
  const { user, self } = await requireOnboardedUser();
  const [refs, people, viewer, purchases, allProducts] = await Promise.all([
    loadAstroRefs(db),
    listPeopleWithSigns(user.id),
    loadViewer(db, user.id),
    listPurchases(db, user.id, 50),
    productsByCode(db),
  ]);
  const { sign, period } = describeBirthDate(self.birthDate, refs);
  const others = people.filter((p) => p.relation !== "self");
  const offers = (await offersForPerson(db, viewer, self)).filter(
    (o) => o.product.personCount === 1,
  );
  const catalog = allProducts;

  // Suggest a synastry with the closest person we don't have one with yet (family/romantic first).
  const owned = new Set(
    purchases.filter((p) => p.productCode === "synastry").map((p) => p.subjectKey),
  );
  const rank = { romantic: 0, family: 1, friend: 2, other: 3, self: 9 } as const;
  const suggestion = [...others]
    .sort((a, b) => rank[RELATION_GROUP[a.relation]] - rank[RELATION_GROUP[b.relation]])
    .find((p) => !owned.has(subjectKey([self.id, p.id])));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">{mn.home.greeting}</p>
        <h1 className="text-[34px] leading-tight font-semibold lg:text-[52px]">{self.name}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <SignHero
          label={mn.hero.yourSign}
          signCode={sign.code}
          signName={sign.nameMn}
          chips={[`${sign.startMd} – ${sign.endMd}`, `${period.no}-р үе`]}
        />

        <section className="flex flex-col gap-3 lg:rounded-[32px] lg:bg-surface lg:p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold lg:text-[28px]">{mn.home.myPeople}</h2>
            <Link href="/people" className="text-sm font-semibold text-highlight">
              {mn.home.all}
            </Link>
          </div>
          <div className="-mx-4 scrollbar-none flex gap-2.5 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
            {others.map((p) => (
              <PersonTile key={p.id} person={p} />
            ))}
            <Link
              href="/people/new"
              aria-label={mn.people.add}
              className="flex w-22 shrink-0 flex-col items-center justify-center gap-1.5 rounded-3xl border-2 border-dashed border-border py-3 text-xs font-semibold text-highlight"
            >
              <Plus className="size-6" aria-hidden />
              {mn.home.add}
            </Link>
          </div>
        </section>
      </div>

      {suggestion && catalog.get("synastry")?.isActive && (
        <Link
          href={`/buy/synastry?a=${self.id}&b=${suggestion.id}`}
          className="flex items-center gap-4 rounded-[28px] bg-nav p-5 text-nav-active"
        >
          <ProductIcon
            product={catalog.get("synastry")}
            className="bg-nav-active/15 text-nav-active"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-lg font-semibold">
              {mn.home.suggestion(relationText(suggestion))}
            </span>
            <span className="text-sm text-nav-fg">
              {mn.home.suggestionSub(sign.nameMn, suggestion.signName)}
            </span>
          </span>
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold lg:text-[28px]">{mn.home.forMe}</h2>
        <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {offers.map((o) => (
            <li key={o.product.code}>
              <Link
                href={o.purchaseId ? `/r/${o.purchaseId}` : `/buy/${o.product.code}?a=${self.id}`}
                className="flex h-full flex-col gap-3 rounded-3xl bg-surface p-4 lg:p-5"
              >
                <ProductIcon product={o.product} />
                <span className="text-sm leading-tight font-semibold lg:text-base">
                  {o.product.nameMn}
                </span>
                <span className="mt-auto text-xs font-semibold lg:text-sm">
                  {o.purchaseId ? (
                    <span className="text-highlight">{mn.readings.read} →</span>
                  ) : (
                    <span className="text-muted-foreground">{formatMnt(o.product.price)}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {purchases.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold lg:text-[28px]">{mn.readings.recent}</h2>
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-3xl bg-surface">
            {purchases.slice(0, 3).map((p) => (
              <li key={p.id}>
                <Link href={`/r/${p.id}`} className="flex items-center gap-3 px-4 py-3.5">
                  <ProductIcon product={catalog.get(p.productCode)} className="size-10" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">
                      {catalog.get(p.productCode)?.nameMn ?? p.productCode}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {p.snapshot.persons.map((x) => x.name).join(" × ")}
                    </span>
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
