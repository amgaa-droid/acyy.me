import { ArrowRight, Check, ChevronDown, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Avatar } from "@/components/app/avatar";
import { BrandMark } from "@/components/app/brand-mark";
import { ConstellationArt } from "@/components/app/constellation";
import { BirthdayReveal } from "@/components/landing/birthday-reveal";
import { StickyCta } from "@/components/landing/sticky-cta";
import { ProductIcon } from "@/components/readings/product-icon";
import { ScoreRing } from "@/components/readings/score-ring";
import { APP_NAME } from "@/env";
import { formatMnt, mn } from "@/i18n/mn";
import { AVATAR_SEEDS } from "@/lib/avatar-seeds";
import { cn } from "@/lib/utils";
import { getSession } from "@/server/auth/session";
import { listActiveProducts } from "@/server/catalog";
import { db } from "@/server/db";
import { bestValueIndex, listActivePackages } from "@/server/topup-packages";

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME} — ${mn.landing.hero.title}` },
  description: mn.landing.metaDescription,
};

const loginTo = (next: string) => `/login?${new URLSearchParams({ next })}`;

const primaryCta =
  "flex h-13 items-center justify-center gap-2 rounded-full bg-fg px-6 text-base font-semibold text-bg";

export default async function LandingPage() {
  if (await getSession()) redirect("/home");

  const t = mn.landing;
  const [products, packages] = await Promise.all([listActiveProducts(db), listActivePackages(db)]);
  const birthdayPrice = products.find((p) => p.code === "birthday")?.price ?? 2000;
  const synastry = products.find((p) => p.code === "synastry");
  const cheapest = Math.min(...products.map((p) => p.price));
  const best = bestValueIndex(packages);

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg">
      {/* ---- Top bar ---- */}
      <header className="sticky top-0 z-20 bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark className="size-7 text-highlight" />
            <span className="font-heading text-xl font-semibold">{APP_NAME}</span>
          </Link>
          <Link
            href="/login"
            className="flex h-11 items-center rounded-full bg-surface px-5 text-sm font-semibold"
          >
            {t.login}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 pb-32 lg:gap-24 lg:px-8 lg:pb-24">
        {/* ---- Hero + free reveal ---- */}
        <section
          id="reveal"
          className="grid scroll-mt-20 items-center gap-8 pt-4 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:pt-12"
        >
          <div className="relative">
            <ConstellationArt
              sign="leo"
              className="pointer-events-none absolute -top-10 -right-16 -z-0 size-64 opacity-30 lg:-top-16 lg:right-0 lg:size-96"
            />
            <div className="relative flex flex-col gap-5">
              <span className="flex w-fit items-center gap-1.5 rounded-full bg-tint-1 px-3 py-1.5 text-xs font-semibold text-highlight">
                <Sparkles className="size-3.5" aria-hidden /> {t.hero.eyebrow}
              </span>
              <h1 className="font-heading text-[42px] leading-[1.02] font-semibold text-balance lg:text-7xl">
                {t.hero.title}
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground lg:text-xl">{t.hero.subtitle}</p>
            </div>
          </div>
          <BirthdayReveal price={birthdayPrice} />
        </section>

        {/* ---- Proof strip (real catalogue facts, not invented reviews) ---- */}
        <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
          {t.stats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                "flex flex-col gap-1 rounded-3xl p-4 lg:p-6",
                ["bg-tint-1", "bg-tint-2", "bg-tint-3", "bg-surface"][i % 4],
              )}
            >
              <span className="font-heading text-3xl font-semibold lg:text-4xl">
                {i === 2 ? formatMnt(cheapest) : s.value}
              </span>
              <span className="text-sm text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </section>

        {/* ---- Products ---- */}
        <section className="flex flex-col gap-6">
          <SectionTitle title={t.productsTitle} subtitle={t.productsSubtitle} />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {products.map((p) => {
              const badge = t.productBadges[p.code];
              return (
                <li key={p.code}>
                  <Link
                    href={loginTo(`/buy/${p.code}`)}
                    className="flex h-full flex-col gap-4 rounded-[28px] bg-surface p-5 transition hover:ring-2 hover:ring-border"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <ProductIcon product={p} />
                      {badge && (
                        <span className="rounded-full bg-subtle px-3 py-1 text-xs font-semibold">
                          {badge}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                      <span className="text-lg font-semibold">{p.nameMn}</span>
                      <span className="text-sm leading-relaxed text-muted-foreground">
                        {t.productHooks[p.code] ?? p.description}
                      </span>
                    </div>
                    <span className="flex h-11 items-center justify-between rounded-full bg-subtle pr-2 pl-4 text-sm font-semibold">
                      {formatMnt(p.price)}
                      <span className="flex items-center gap-1 rounded-full bg-fg px-3.5 py-1.5 text-bg">
                        {t.open} <ArrowRight className="size-3.5" aria-hidden />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ---- Synastry spotlight ---- */}
        {synastry && (
          <section className="grid items-center gap-8 overflow-hidden rounded-[32px] bg-nav p-6 text-nav-active lg:grid-cols-2 lg:gap-12 lg:p-12">
            <div className="flex flex-col gap-4">
              <span className="text-xs font-semibold tracking-widest text-nav-fg uppercase">
                {t.synastry.eyebrow}
              </span>
              <h2 className="font-heading text-4xl leading-tight font-semibold text-balance lg:text-5xl">
                {t.synastry.title}
              </h2>
              <p className="text-nav-fg lg:text-lg">{t.synastry.body}</p>
              <ul className="flex flex-col gap-2">
                {t.synastry.points.map((point) => (
                  <li key={point} className="flex items-center gap-2 font-medium">
                    <Check className="size-4.5" aria-hidden /> {point}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-nav-fg">{t.synastry.invite}</p>
              <Link
                href={loginTo("/buy/synastry")}
                className="mt-2 flex h-13 items-center justify-center gap-2 rounded-full bg-nav-active px-6 font-semibold text-nav-active-fg lg:w-fit"
              >
                {t.synastry.cta} · {formatMnt(synastry.price)}
                <ArrowRight className="size-4.5" aria-hidden />
              </Link>
            </div>
            <div className="relative flex flex-col items-center gap-5 rounded-3xl bg-surface p-6 text-fg">
              <span className="absolute top-4 left-4 rounded-full bg-subtle px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {t.synastry.example}
              </span>
              <div className="flex items-center gap-3 pt-4">
                <PairAvatar seed={AVATAR_SEEDS[3]} label={t.synastry.pair[0]} tint="bg-tint-1" />
                <ScoreRing value={86} size={84} />
                <PairAvatar seed={AVATAR_SEEDS[8]} label={t.synastry.pair[1]} tint="bg-tint-2" />
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {t.synastry.points.slice(0, 2).map((point) => (
                  <span
                    key={point}
                    className="rounded-full bg-subtle px-3 py-1.5 text-xs font-medium"
                  >
                    {point}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---- People ---- */}
        <section className="grid items-center gap-6 lg:grid-cols-2 lg:gap-12">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold tracking-widest text-highlight uppercase">
              {t.people.eyebrow}
            </span>
            <h2 className="font-heading text-[34px] leading-tight font-semibold lg:text-5xl">
              {t.people.title}
            </h2>
            <p className="text-muted-foreground lg:text-lg">{t.people.body}</p>
          </div>
          <ul className="grid grid-cols-4 gap-3">
            {t.people.relations.map((label, i) => (
              <li key={label} className="flex flex-col items-center gap-1.5 text-center">
                <Avatar
                  seed={AVATAR_SEEDS[(i * 3 + 1) % AVATAR_SEEDS.length]}
                  size={64}
                  className={cn("border-0", ["bg-tint-1", "bg-tint-2", "bg-tint-3"][i % 3])}
                />
                <span className="text-xs font-medium">{label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ---- How it works ---- */}
        <section className="flex flex-col gap-6">
          <SectionTitle title={t.how.title} />
          <ol className="grid gap-3 lg:grid-cols-3 lg:gap-4">
            {t.how.steps.map((step, i) => (
              <li key={step.title} className="flex gap-4 rounded-3xl bg-surface p-5 lg:flex-col">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint-1 font-heading text-lg font-semibold text-highlight">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">{step.title}</span>
                  <span className="text-sm text-muted-foreground">{step.body}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ---- Wallet tiers ---- */}
        <section className="flex flex-col gap-6">
          <SectionTitle title={t.wallet.title} subtitle={t.wallet.subtitle} />
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
                    <span className="mb-1 w-fit rounded-full bg-highlight px-2.5 py-1 text-[11px] font-semibold text-highlight-fg">
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

        {/* ---- FAQ ---- */}
        <section className="mx-auto flex w-full max-w-[680px] flex-col gap-6">
          <SectionTitle title={t.faqTitle} />
          <div className="flex flex-col gap-2.5">
            {t.faq.map((item) => (
              <details key={item.q} className="group rounded-3xl bg-surface px-5">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown
                    className="size-5 shrink-0 transition group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="pb-5 text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---- Final CTA ---- */}
        <section className="relative overflow-hidden rounded-[32px] bg-tint-1 p-8 text-center lg:p-14">
          <ConstellationArt
            sign="gemini"
            className="pointer-events-none absolute -bottom-16 -left-16 size-60 opacity-40"
          />
          <div className="relative flex flex-col items-center gap-3">
            <h2 className="font-heading text-[34px] leading-tight font-semibold text-balance lg:text-5xl">
              {t.final.title}
            </h2>
            <p className="text-muted-foreground">{t.final.body}</p>
            <Link href="/login" className={cn(primaryCta, "mt-3 w-full sm:w-fit")}>
              {t.final.cta} <ArrowRight className="size-4.5" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      {/* ---- Mobile sticky CTA ---- */}
      <StickyCta targetId="reveal" label={t.stickyCta} />
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-heading text-[34px] leading-tight font-semibold lg:text-5xl">{title}</h2>
      {subtitle && <p className="text-muted-foreground lg:text-lg">{subtitle}</p>}
    </div>
  );
}

function PairAvatar({ seed, label, tint }: { seed: string; label: string; tint: string }) {
  return (
    <span className="flex flex-col items-center gap-1.5">
      <Avatar seed={seed} size={72} className={cn("border-0", tint)} />
      <span className="text-xs font-semibold">{label}</span>
    </span>
  );
}
