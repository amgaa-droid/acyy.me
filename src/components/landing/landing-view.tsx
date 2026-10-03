import { ArrowRight, Check, ChevronDown } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/app/avatar";
import { ConstellationArt } from "@/components/app/constellation";
import { DailyTeaser } from "@/components/landing/daily-teaser";
import { CurrentThemeToggle } from "@/components/app/current-theme-toggle";
import { LandingPlanets } from "@/components/landing/landing-planets";
import { LegalFooter } from "@/components/legal/legal-footer";
import { StickyCta } from "@/components/landing/sticky-cta";
import { PriceAction } from "@/components/readings/price-action";
import { ProductIcon } from "@/components/readings/product-icon";
import {
  PairHero,
  type PairHeroPerson,
  SummaryFields,
} from "@/components/readings/reading-highlights";
import { APP_NAME } from "@/env";
import { formatMnt, mn } from "@/i18n/mn";
import { AVATAR_SEEDS } from "@/lib/avatar-seeds";
import { avatarUrl } from "@/lib/avatars";
import { formatBirthDate } from "@/lib/birth-date";
import { BIRTHDAY_PRODUCT, SYNASTRY_PRODUCT } from "@/lib/catalog-refs";
import { fillTokens, type BodySection, type LandingContent } from "@/lib/landing-content";
import { cn } from "@/lib/utils";
import { describeBirthDate, type AstroRefs } from "@/server/astro/refs";
import type { Product } from "@/server/catalog";
import type { LandingDaily } from "@/server/landing-daily";
import { bestValueIndex, type PackageOption } from "@/server/topup-packages";

const primaryCta =
  "flex h-13 items-center justify-center gap-2 rounded-full bg-fg px-6 text-base font-semibold text-bg";

/**
 * The signed-out landing page, drawn from CMS content (src/lib/landing-content.ts) plus live
 * catalogue data (prices, packages). Used by "/" (published) and the admin preview (draft).
 */
export function LandingView({
  content: c,
  products,
  packages,
  refs,
  daily,
}: {
  content: LandingContent;
  products: Product[];
  packages: PackageOption[];
  refs: AstroRefs;
  /** Today's free daily horoscope teaser; null hides the section (no active kinds). */
  daily: LandingDaily | null;
}) {
  const t = mn.landing;
  const birthdayPrice = products.find((p) => p.code === BIRTHDAY_PRODUCT)?.price ?? 2000;
  const synastry = products.find((p) => p.code === SYNASTRY_PRODUCT);
  const cheapest = products.length ? Math.min(...products.map((p) => p.price)) : 1000;
  const best = bestValueIndex(packages);
  // Formatted once: every CMS text on the page goes through f().
  const tokens = {
    minPrice: formatMnt(cheapest),
    birthdayPrice: formatMnt(birthdayPrice),
    synastryPrice: formatMnt(synastry?.price ?? cheapest),
  };
  const f = (s: string) => fillTokens(s, tokens);
  const override = new Map(c.products.items.map((i) => [i.code, i]));
  const examplePerson = (i: 0 | 1): PairHeroPerson => {
    const p = c.synastry.pair[i];
    const astro = p.birthDate ? describeBirthDate(p.birthDate, refs) : null;
    return {
      name: p.label,
      relation: null,
      birthDate: p.birthDate,
      avatarSeed: AVATAR_SEEDS[p.seed],
      tint: i === 0 ? "bg-tint-2" : "bg-tint-3",
      sign: astro ? { code: astro.sign.code, name: astro.sign.nameMn } : undefined,
      period: astro?.period.no,
    };
  };

  const sections: Record<BodySection, React.ReactNode> = {
    daily: daily && (
      <DailyTeaser
        copy={{
          ...c.daily,
          eyebrow: f(c.daily.eyebrow),
          title: f(c.daily.title),
          body: f(c.daily.body),
          cta: f(c.daily.cta),
          note: f(c.daily.note),
        }}
        data={daily}
      />
    ),
    stats: c.stats.items.length > 0 && (
      <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
        {c.stats.items.map((s, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col gap-1 rounded-3xl p-4 lg:p-6",
              ["bg-tint-1", "bg-tint-2", "bg-tint-3", "bg-surface"][i % 4],
            )}
          >
            <span className="font-heading text-3xl font-semibold lg:text-4xl">{f(s.value)}</span>
            <span className="text-sm text-muted-foreground">{f(s.label)}</span>
          </div>
        ))}
      </section>
    ),

    products: (
      <section className="flex flex-col gap-6">
        <SectionTitle title={f(c.products.title)} subtitle={f(c.products.subtitle)} />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {products.map((p) => {
            const o = override.get(p.code);
            return (
              <li key={p.code}>
                <Link
                  href="/login"
                  className="flex h-full flex-col gap-4 rounded-3xl bg-surface p-5 transition hover:ring-2 hover:ring-border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <ProductIcon product={p} />
                    {o?.badge && (
                      <span className="rounded-full bg-subtle px-3 py-1 text-xs font-semibold">
                        {f(o.badge)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <span className="text-lg font-semibold">{p.nameMn}</span>
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {o?.hook ? f(o.hook) : p.description}
                    </span>
                  </div>
                  <PriceAction price={p.price} label={c.products.open} />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    ),

    synastry: synastry && (
      <section className="grid items-center gap-8 overflow-hidden rounded-3xl bg-nav p-6 text-nav-active lg:grid-cols-2 lg:gap-12 lg:p-12">
        <div className="flex flex-col gap-4">
          {c.synastry.eyebrow && (
            <span className="text-xs font-semibold tracking-widest text-nav-fg uppercase">
              {f(c.synastry.eyebrow)}
            </span>
          )}
          <h2 className="font-heading text-4xl leading-tight font-semibold text-balance lg:text-5xl">
            {f(c.synastry.title)}
          </h2>
          {c.synastry.body && <p className="text-nav-fg lg:text-lg">{f(c.synastry.body)}</p>}
          <ul className="flex flex-col gap-2">
            {c.synastry.points.map((point, i) => (
              <li key={i} className="flex items-center gap-2 font-medium">
                <Check className="size-4.5" aria-hidden /> {f(point)}
              </li>
            ))}
          </ul>
          {c.synastry.invite && <p className="text-sm text-nav-fg">{f(c.synastry.invite)}</p>}
          <Link
            href="/login"
            className="mt-2 flex h-13 items-center justify-center gap-2 rounded-full bg-nav-active px-6 font-semibold text-nav-active-fg lg:w-fit"
          >
            {f(c.synastry.cta)} · {formatMnt(synastry.price)}
            <ArrowRight className="size-4.5" aria-hidden />
          </Link>
        </div>
        <div className="flex flex-col gap-3 text-fg">
          <span className="self-start rounded-full bg-nav-active/10 px-3 py-1.5 text-xs font-semibold tracking-wider text-nav-fg uppercase">
            {c.synastry.example}
          </span>
          {/* The same hero and summary card as a real pair reading (/r/[purchaseId]). */}
          <PairHero
            headingLevel={3}
            title={
              f(c.synastry.exampleTitle) ||
              `${c.synastry.pair[0].label} & ${c.synastry.pair[1].label}`
            }
            people={[examplePerson(0), examplePerson(1)]}
          />
          <SummaryFields
            fields={[
              {
                code: "good",
                name: c.demo.goodLabel,
                kind: "chips" as const,
                items: c.synastry.goodFor,
              },
              {
                code: "caution",
                name: c.demo.cautionLabel,
                kind: "alert" as const,
                items: c.synastry.cautionFor,
              },
            ]
              .filter((x) => x.items.length > 0)
              .map(({ items, ...x }) => ({ ...x, isFree: true, value: items.join("\n") }))}
          />
        </div>
      </section>
    ),

    people: (
      <section className="grid items-center gap-6 lg:grid-cols-2 lg:gap-12">
        <div className="flex flex-col gap-3">
          {c.people.eyebrow && (
            <span className="text-xs font-semibold tracking-widest text-highlight uppercase">
              {f(c.people.eyebrow)}
            </span>
          )}
          <h2 className="font-heading text-4xl leading-tight font-semibold lg:text-5xl">
            {f(c.people.title)}
          </h2>
          {c.people.body && <p className="text-muted-foreground lg:text-lg">{f(c.people.body)}</p>}
        </div>
        <ul className="grid grid-cols-4 gap-3">
          {c.people.relations.map(({ label, seed }, i) => (
            <li key={i} className="flex flex-col items-center gap-1.5 text-center">
              <Avatar
                seed={AVATAR_SEEDS[seed]}
                size={64}
                className={cn("border-0", ["bg-tint-1", "bg-tint-2", "bg-tint-3"][i % 3])}
              />
              <span className="text-xs font-medium">{label}</span>
            </li>
          ))}
        </ul>
      </section>
    ),

    how: (
      <section className="flex flex-col gap-6">
        <SectionTitle title={f(c.how.title)} />
        <ol className="grid gap-3 lg:grid-cols-3 lg:gap-4">
          {c.how.steps.map((step, i) => (
            <li key={i} className="flex gap-4 rounded-3xl bg-surface p-5 lg:flex-col">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint-1 font-heading text-lg font-semibold text-highlight">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <span className="font-semibold">{f(step.title)}</span>
                <span className="text-sm text-muted-foreground">{f(step.body)}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
    ),

    wallet: packages.length > 0 && (
      <section className="flex flex-col gap-6">
        <SectionTitle title={f(c.wallet.title)} subtitle={f(c.wallet.subtitle)} />
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {packages.map((tier, i) => {
            const isBest = i === best;
            const total = tier.amount + tier.bonus;
            return (
              <li
                key={tier.id}
                className={cn(
                  "relative flex flex-col gap-1 rounded-3xl p-5",
                  isBest ? "bg-fg text-bg" : "bg-surface",
                )}
              >
                {isBest && (
                  <span className="mb-1 w-fit rounded-full bg-highlight px-2.5 py-1 text-xs font-semibold text-highlight-fg">
                    {t.wallet.best}
                  </span>
                )}
                <span className={cn("text-xs", isBest ? "opacity-70" : "text-muted-foreground")}>
                  {t.wallet.pay}
                </span>
                <span className="font-heading text-2xl font-semibold">
                  {formatMnt(tier.amount)}
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isBest ? "text-bg" : tier.bonus ? "text-highlight" : "text-muted-foreground",
                  )}
                >
                  {tier.bonus ? t.wallet.bonus(formatMnt(tier.bonus)) : "—"}
                </span>
                <span
                  className={cn("mt-2 text-xs", isBest ? "opacity-70" : "text-muted-foreground")}
                >
                  {t.wallet.get} {formatMnt(total)} ·{" "}
                  {t.wallet.readings(Math.floor(total / cheapest))}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    ),

    faq: c.faq.items.length > 0 && (
      <section className="mx-auto flex w-full max-w-[680px] flex-col gap-6">
        <SectionTitle title={f(c.faq.title)} />
        <div className="flex flex-col gap-2.5">
          {c.faq.items.map((item, i) => (
            <details key={i} className="group rounded-3xl bg-surface px-5">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
                {f(item.q)}
                <ChevronDown
                  className="size-5 shrink-0 transition group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="pb-5 whitespace-pre-line text-muted-foreground">{f(item.a)}</p>
            </details>
          ))}
        </div>
      </section>
    ),

    final: (
      <section className="relative overflow-hidden rounded-3xl bg-tint-1 p-8 text-center lg:p-14">
        <ConstellationArt
          sign="gemini"
          className="pointer-events-none absolute -bottom-16 -left-16 size-60 opacity-40"
        />
        <div className="relative flex flex-col items-center gap-3">
          <h2 className="font-heading text-4xl leading-tight font-semibold text-balance lg:text-5xl">
            {f(c.final.title)}
          </h2>
          {c.final.body && <p className="text-muted-foreground">{f(c.final.body)}</p>}
          <Link href="/login" className={cn(primaryCta, "mt-3 w-full sm:w-fit")}>
            {f(c.final.cta)} <ArrowRight className="size-4.5" aria-hidden />
          </Link>
        </div>
      </section>
    ),
  };

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg">
      {/* ---- First screen: the planet system, as in the app ---- */}
      <LandingPlanets
        appName={APP_NAME}
        headerAction={<CurrentThemeToggle />}
        copy={{
          eyebrow: f(c.hero.eyebrow),
          title: f(c.hero.title),
          subtitle: f(c.hero.subtitle),
          pickBirthday: f(c.hero.pickBirthday),
          hint: f(c.hero.hint),
          goodLabel: c.demo.goodLabel,
          cautionLabel: c.demo.cautionLabel,
          example: c.demo.example,
          cta: f(c.demo.cta),
          pairTitle: f(c.synastry.title),
          pairBody: f(c.synastry.body),
          pairPoints: c.synastry.points.map(f),
        }}
        people={c.demo.people.map((d) => ({
          id: d.id,
          name: d.name,
          tint: d.tint,
          birthDate: formatBirthDate(d.birthDate),
          signName: describeBirthDate(d.birthDate, refs).sign.nameMn,
          avatarUri: avatarUrl(AVATAR_SEEDS[d.seed % AVATAR_SEEDS.length]),
        }))}
        links={c.demo.links.map((l) => ({ ...l, text: f(l.text) }))}
        products={products
          .filter((p) => p.personCount === 1)
          .map((p) => {
            const hook = override.get(p.code)?.hook;
            return {
              code: p.code,
              name: p.nameMn,
              icon: p.icon,
              price: p.price,
              hook: hook ? f(hook) : (p.description ?? ""),
            };
          })}
        synastry={synastry ? { price: synastry.price } : null}
        birthdayPrice={birthdayPrice}
      />

      <main
        id="more"
        className="mx-auto flex max-w-6xl scroll-mt-4 flex-col gap-16 px-4 pt-14 pb-16 lg:gap-24 lg:px-8 lg:pt-20 lg:pb-16"
      >
        {c.layout
          .filter((s) => s.visible)
          .map((s) => (sections[s.key] ? <div key={s.key}>{sections[s.key]}</div> : null))}
      </main>

      {/* Google/Facebook sign-in ask for the terms and privacy links on the home page. */}
      <footer className="mx-auto max-w-6xl px-4 pb-32 lg:px-8 lg:pb-12">
        <LegalFooter className="border-t border-border pt-4" />
        <p className="mt-2 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {APP_NAME}
        </p>
      </footer>

      {/* ---- Mobile sticky CTA ---- */}
      <StickyCta targetId="top" label={t.stickyCta} />
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-heading text-4xl leading-tight font-semibold lg:text-5xl">{title}</h2>
      {subtitle && <p className="text-muted-foreground lg:text-lg">{subtitle}</p>}
    </div>
  );
}
