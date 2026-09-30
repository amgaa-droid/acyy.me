import { ChevronLeft, Lock, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { Avatar } from "@/components/app/avatar";
import { ProductIcon } from "@/components/readings/product-icon";
import { formatMnt, mn } from "@/i18n/mn";
import type { Relation } from "@/lib/domain";
import { relationText, relationTint } from "@/lib/people";
import { cn } from "@/lib/utils";
import { describeBirthDate, loadAstroRefs } from "@/server/astro/refs";
import { requireOnboardedUser } from "@/server/auth/current";
import { getProduct, isEligible, loadViewer } from "@/server/catalog";
import { db } from "@/server/db";
import { listPeople } from "@/server/persons";
import {
  NotEligibleError,
  PersonsInvalidError,
  findPurchase,
  preparePurchase,
} from "@/server/purchase";
import { getPreview } from "@/server/reading";
import { getBalance } from "@/server/wallet";
import { BuyConfirm } from "./buy-confirm";

export const metadata: Metadata = { title: mn.readings.title };

const id = z.uuid();
const one = (v: string | string[] | undefined) =>
  typeof v === "string" && id.safeParse(v).success ? v : undefined;

export default async function BuyPage({ params, searchParams }: PageProps<"/buy/[product]">) {
  const { product: code } = await params;
  const sp = await searchParams;
  const { user } = await requireOnboardedUser();
  const product = await getProduct(db, code);
  if (!product || !product.isActive) notFound();
  const t = mn.buy;

  const [people, viewer, refs] = await Promise.all([
    listPeople(db, user.id),
    loadViewer(db, user.id),
    loadAstroRefs(db),
  ]);
  const single = { ...product, personCount: 1 };
  const eligible = people.filter((p) => isEligible(single, [p], viewer));

  const a = one(sp.a);
  const b = product.personCount === 2 ? one(sp.b) : undefined;
  const chosenA = a ? eligible.find((p) => p.id === a) : undefined;
  const chosenB = b ? eligible.find((p) => p.id === b && p.id !== a) : undefined;
  const here = (extra: Record<string, string>) => `/buy/${code}?${new URLSearchParams(extra)}`;

  const header = (
    <div className="flex items-center gap-3">
      <Link
        href={chosenA ? `/buy/${code}` : "/readings"}
        aria-label={mn.common.back}
        className="flex size-11 items-center justify-center rounded-full bg-surface"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
      <ProductIcon code={product.code} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-semibold">{product.nameMn}</span>
        <span className="text-sm text-muted-foreground">{formatMnt(product.price)}</span>
      </div>
    </div>
  );

  // ---- Step 1/2: pick people ----
  const needsA = !chosenA;
  const needsB = product.personCount === 2 && chosenA && !chosenB;
  if (needsA || needsB) {
    const slot = needsA ? "a" : "b";
    const options = needsA ? eligible : eligible.filter((p) => p.id !== chosenA!.id);
    const next = needsA ? `/buy/${code}` : here({ a: chosenA!.id });
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        {header}
        <div>
          <h1 className="text-[34px] leading-none font-semibold lg:text-[44px]">
            {product.personCount === 1 ? t.pickPerson : needsA ? t.pickFirst : t.pickSecond}
          </h1>
          {product.personCount === 2 && (
            <p className="mt-2 text-sm text-muted-foreground">{t.pickSecondHint}</p>
          )}
        </div>
        {chosenA && (
          <ChosenPerson
            person={chosenA}
            signName={describeBirthDate(chosenA.birthDate, refs).sign.nameMn}
          />
        )}
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {options.map((p) => (
            <li key={p.id}>
              <Link
                href={needsA ? here({ a: p.id }) : here({ a: chosenA!.id, b: p.id })}
                className="flex items-center gap-3 rounded-3xl bg-surface p-3 hover:ring-2 hover:ring-border"
              >
                <Avatar
                  seed={p.avatarSeed}
                  size={48}
                  className={cn("border-0", relationTint(p.relation as Relation))}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{p.name}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {relationText(p)} · {describeBirthDate(p.birthDate, refs).sign.nameMn}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href={`/people/new?${new URLSearchParams({ next, slot })}`}
              className="flex h-full min-h-18 items-center gap-3 rounded-3xl border-2 border-dashed border-border p-3 font-semibold text-highlight"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-surface">
                <Plus className="size-5" aria-hidden />
              </span>
              {t.newPerson}
            </Link>
          </li>
        </ul>
        {options.length === 0 && <p className="text-sm text-muted-foreground">{t.noneEligible}</p>}
      </div>
    );
  }

  // ---- Step 3: preview + confirm ----
  const personIds = [chosenA!.id, ...(chosenB ? [chosenB.id] : [])];
  let prepared;
  try {
    prepared = await preparePurchase(db, user.id, product.code, personIds);
  } catch (err) {
    if (err instanceof NotEligibleError || err instanceof PersonsInvalidError) notFound();
    throw err;
  }
  const owned = await findPurchase(db, user.id, product.code, prepared.subject);
  if (owned) redirect(`/r/${owned.id}`);

  const [preview, balance] = await Promise.all([
    getPreview(db, product.code, prepared.snapshot.keys),
    getBalance(db, user.id),
  ]);
  const returnTo = here({ a: chosenA!.id, ...(chosenB ? { b: chosenB.id } : {}), confirm: "1" });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {header}
      <div className="flex flex-wrap gap-2">
        {prepared.people.map((p, i) => (
          <ChosenPerson
            key={p.id}
            person={p}
            signName={describeBirthDate(p.birthDate, refs).sign.nameMn}
            changeHref={i === 0 ? `/buy/${code}` : here({ a: chosenA!.id })}
          />
        ))}
      </div>

      <article className="flex flex-col gap-4 rounded-[32px] bg-surface p-6">
        <span className="text-xs font-semibold tracking-widest text-highlight uppercase">
          {t.preview}
        </span>
        {preview.sections.map((s) => (
          <section key={s.section} className="flex flex-col gap-2">
            {s.section !== "main" && (
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {mn.reading.sections[s.section]}
              </span>
            )}
            <h2 className="text-[28px] leading-tight font-semibold">{s.title}</h2>
            {s.excerpt && <p className="text-base leading-relaxed">{s.excerpt}</p>}
          </section>
        ))}
        {/* Decorative placeholder lines — the real text is not on the page. */}
        <div aria-hidden className="flex flex-col gap-2.5 pt-1">
          {[100, 94, 97, 62].map((w) => (
            <div key={w} className="h-3 rounded-full bg-subtle" style={{ width: `${w}%` }} />
          ))}
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-4" aria-hidden /> {t.locked}
        </p>
      </article>

      <BuyConfirm
        productCode={product.code}
        productName={product.nameMn}
        personIds={personIds}
        price={product.price}
        balance={balance}
        returnTo={returnTo}
        autoOpen={sp.confirm === "1"}
        subtitle={prepared.people.map((p) => p.name).join(" × ")}
      />
    </div>
  );
}

function ChosenPerson({
  person,
  signName,
  changeHref,
}: {
  person: { name: string; avatarSeed: string; relation: string; relationLabel: string | null };
  signName: string;
  changeHref?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-full bg-surface py-1.5 pr-2 pl-1.5">
      <Avatar
        seed={person.avatarSeed}
        size={36}
        className={cn("border-0", relationTint(person.relation as Relation))}
      />
      <span className="text-sm">
        <span className="font-semibold">{person.name}</span>
        <span className="text-muted-foreground"> · {signName}</span>
      </span>
      {changeHref && (
        <Link
          href={changeHref}
          className="ml-1 rounded-full bg-subtle px-3 py-1.5 text-xs font-semibold"
        >
          {mn.buy.change}
        </Link>
      )}
    </div>
  );
}
