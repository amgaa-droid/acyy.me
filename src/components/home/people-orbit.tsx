import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import type { PersonSummary } from "@/components/people/person-card";
import { PRODUCT_ICON_COMPONENTS } from "@/components/readings/product-icon";
import { mn } from "@/i18n/mn";
import { avatarDataUri } from "@/lib/avatars";
import type { ProductIconName } from "@/lib/domain";
import {
  ORBIT_DESKTOP as D,
  ORBIT_MOBILE as M,
  ORBIT_MOTION,
  badgePoint,
  labelAbove,
  orbitVisible,
  type OrbitBody,
} from "@/lib/orbit";
import { relationText, relationTint } from "@/lib/people";
import { cn } from "@/lib/utils";
import type { OrbitReadings } from "@/server/orbit";

type ProductLook = { icon: string; nameMn: string };

type PeopleOrbitProps = {
  self: { id: string; name: string; avatarSeed: string; signName: string; birthDate: string };
  /** Closest first (src/server/orbit.ts byCloseness). */
  people: PersonSummary[];
  readings: Map<string, OrbitReadings>;
  products: Map<string, ProductLook>;
  /** Desktop only: the sign block on the left of the stage. */
  aside: ReactNode;
};

const DRIFT = {
  a: "motion-safe:animate-drift-a",
  b: "motion-safe:animate-drift-b",
  c: "motion-safe:animate-drift-c",
} as const;

/** Twinkling stars, % of the stage. */
const STARS = [
  { x: 40, y: 5, d: 0 },
  { x: 92, y: 44, d: 1.2 },
  { x: 38, y: 95, d: 2.1 },
  { x: 6, y: 30, d: 0.6 },
  { x: 70, y: 92, d: 2.8 },
  { x: 97, y: 8, d: 1.7 },
];

/** CSS variables that place a body at its mobile and desktop positions. */
function placeVars(m: OrbitBody, d: OrbitBody): CSSProperties {
  return {
    "--x": `${m.x}%`,
    "--y": `${m.y}%`,
    "--s": `${m.size}px`,
    "--lx": `${d.x}%`,
    "--ly": `${d.y}%`,
    "--ls": `${d.size}px`,
  } as CSSProperties;
}

/** Caption above or below its planet, per layout (src/lib/orbit.ts labelAbove). */
function captionSide(m: OrbitBody, d: OrbitBody): string {
  const aboveM = labelAbove(M, m);
  const aboveD = labelAbove(D, d);
  return cn(
    aboveM ? "bottom-full mb-1.5 flex-col-reverse" : "top-full mt-1.5 flex-col",
    aboveD
      ? "lg:top-auto lg:bottom-full lg:mt-0 lg:mb-1.5 lg:flex-col-reverse"
      : "lg:top-full lg:bottom-auto lg:mt-1.5 lg:mb-0 lg:flex-col",
  );
}

const PLACED =
  "absolute top-(--y) left-(--x) size-(--s) -translate-1/2 lg:top-(--ly) lg:left-(--lx) lg:size-(--ls)";

/** Two lines from me to a body: one per layout, shown by breakpoint. */
function OrbitLine({ m, d, faint }: { m: OrbitBody; d: OrbitBody; faint?: boolean }) {
  const line = cn(
    "fill-none transition-[stroke,stroke-width] duration-300",
    faint
      ? "stroke-highlight/25 stroke-[1.5] [stroke-dasharray:2_6]"
      : "stroke-highlight/60 stroke-[1.5] [stroke-dasharray:4_6] motion-safe:animate-orbit-flow group-hover/o:stroke-highlight group-hover/o:stroke-[2.5]",
  );
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full overflow-visible transition-opacity duration-300"
    >
      <line
        x1={`${M.me.x}%`}
        y1={`${M.me.y}%`}
        x2={`${m.x}%`}
        y2={`${m.y}%`}
        strokeLinecap="round"
        className={cn(line, "lg:hidden")}
      />
      <line
        x1={`${D.me.x}%`}
        y1={`${D.me.y}%`}
        x2={`${d.x}%`}
        y2={`${d.y}%`}
        strokeLinecap="round"
        className={cn(line, "hidden lg:inline")}
      />
    </svg>
  );
}

function ProductIcons({ codes, products }: { codes: string[]; products: Map<string, ProductLook> }) {
  if (codes.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-highlight">
      {codes.map((code) => {
        const Icon = PRODUCT_ICON_COMPONENTS[products.get(code)?.icon as ProductIconName] ?? Sparkles;
        return <Icon key={code} className="size-3.5" strokeWidth={2} aria-hidden />;
      })}
    </span>
  );
}

/**
 * Home hero: "me" in the middle, people as planets floating around it, joined by dashed lines.
 * A pair reading sits as a badge on its line; more than ORBIT_MAX people fold into "+N".
 */
export function PeopleOrbit({ self, people, readings, products, aside }: PeopleOrbitProps) {
  const t = mn.home.orbit;
  const { shown, more } = orbitVisible(people);
  const own = readings.get(self.id)?.products ?? [];
  const moreSlot = shown.length;

  return (
    <section
      aria-label={t.label}
      className="relative h-[490px] overflow-hidden rounded-[32px] bg-tint-1 lg:h-140"
    >
      <div
        style={placeVars(M.me, D.me)}
        className={cn(
          "absolute inset-0",
          "[&:has(.orbit-item:hover)_.orbit-item:not(:hover)>*]:opacity-40",
          "[&:has(.orbit-me:hover)_line]:stroke-highlight",
        )}
      >
        {/* Orbits and stars */}
        <span
          aria-hidden
          className="absolute top-(--y) left-(--x) size-[284px] -translate-1/2 rounded-full border-[1.5px] border-dashed border-highlight/25 motion-safe:animate-orbit-spin lg:top-(--ly) lg:left-(--lx) lg:size-[380px]"
        />
        <span
          aria-hidden
          className="absolute top-(--y) left-(--x) size-[460px] -translate-1/2 rounded-full border border-highlight/15 lg:top-(--ly) lg:left-(--lx) lg:size-[640px]"
        />
        {STARS.map((s) => (
          <span
            key={`${s.x}-${s.y}`}
            aria-hidden
            className="absolute size-1 rounded-full bg-highlight motion-safe:animate-twinkle"
            style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s` }}
          />
        ))}

        {/* People */}
        {shown.map((person, i) => {
          const m = M.slots[i];
          const d = D.slots[i];
          const motion = ORBIT_MOTION[i];
          const r = readings.get(person.id);
          const pair = r?.pair;
          const bm = badgePoint(M, m);
          const bd = badgePoint(D, d);
          const PairIcon = pair
            ? (PRODUCT_ICON_COMPONENTS[products.get(pair.productCode)?.icon as ProductIconName] ??
              Sparkles)
            : null;
          return (
            <div key={person.id} className="orbit-item group/o contents">
              <OrbitLine m={m} d={d} />
              <div style={placeVars(m, d)} className={cn(PLACED, "transition-opacity duration-300")}>
                <div
                  className={cn(
                    "size-full group-hover/o:[animation-play-state:paused]",
                    DRIFT[motion.drift],
                  )}
                  style={{ animationDelay: `${motion.delay}s` }}
                >
                  <Link
                    href={`/people/${person.id}`}
                    aria-label={`${person.name}, ${relationText(person)}, ${person.signName}`}
                    className="relative block size-full rounded-full"
                  >
                    {motion.ring && (
                      <span
                        aria-hidden
                        className="absolute top-1/2 left-1/2 h-[42%] w-[150%] -translate-1/2 -rotate-[18deg] rounded-[50%] border-[1.5px] border-highlight/35"
                      />
                    )}
                    <span
                      className={cn(
                        "relative flex size-full items-center justify-center overflow-hidden rounded-full border-[3px] border-surface shadow-[0_8px_24px_rgb(0_0_0/0.12)] transition-[scale,rotate,box-shadow] duration-500 ease-[cubic-bezier(.2,.9,.25,1.3)] group-hover/o:scale-115 group-hover/o:-rotate-3 group-hover/o:shadow-[0_0_0_7px_color-mix(in_oklab,var(--highlight)_16%,transparent),0_14px_30px_rgb(0_0_0/0.18)]",
                        relationTint(person.relation),
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- local data URI */}
                      <img
                        src={avatarDataUri(person.avatarSeed)}
                        alt=""
                        className="size-full dark:invert"
                      />
                    </span>
                    <span
                      className={cn(
                        "absolute left-1/2 flex w-28 -translate-x-1/2 items-center gap-1",
                        captionSide(m, d),
                      )}
                    >
                      <span className="max-w-full truncate text-[13px] leading-tight font-semibold lg:text-sm">
                        {person.name}
                      </span>
                      <span className="max-w-full truncate text-[11px] leading-tight text-muted-foreground lg:text-xs">
                        {person.signName}
                      </span>
                      <ProductIcons codes={r?.products ?? []} products={products} />
                    </span>
                  </Link>
                </div>
              </div>
              {pair && PairIcon && (
                <Link
                  href={`/r/${pair.purchaseId}`}
                  aria-label={t.pair(person.name)}
                  style={
                    {
                      "--x": `${bm.x}%`,
                      "--y": `${bm.y}%`,
                      "--lx": `${bd.x}%`,
                      "--ly": `${bd.y}%`,
                    } as CSSProperties
                  }
                  className="absolute top-(--y) left-(--x) z-10 flex size-8 -translate-1/2 items-center justify-center rounded-full border-[1.5px] border-ring-2 bg-surface text-ring-2 transition-[scale,opacity] duration-300 group-hover/o:scale-120 hover:scale-125 motion-safe:animate-ping-soft lg:top-(--ly) lg:left-(--lx) lg:size-9"
                >
                  <PairIcon className="size-4" strokeWidth={2} aria-hidden />
                </Link>
              )}
            </div>
          );
        })}

        {/* "+N": everyone who didn't fit */}
        {more > 0 && (
          <div className="orbit-item group/o contents">
            <OrbitLine m={M.slots[moreSlot]} d={D.slots[moreSlot]} faint />
            <div
              style={placeVars(M.slots[moreSlot], D.slots[moreSlot])}
              className={cn(PLACED, "transition-opacity duration-300")}
            >
              <div className={cn("size-full", DRIFT[ORBIT_MOTION[moreSlot].drift])}>
                <Link
                  href="/people"
                  aria-label={t.moreAria(more)}
                  className="relative flex size-full items-center justify-center rounded-full bg-fg font-heading text-xl font-semibold text-bg shadow-[0_8px_24px_rgb(0_0_0/0.16)] transition-[scale] duration-500 ease-[cubic-bezier(.2,.9,.25,1.3)] group-hover/o:scale-115 lg:text-2xl"
                >
                  +{more}
                  <span className="absolute top-full left-1/2 mt-1.5 -translate-x-1/2 font-sans text-[13px] font-semibold whitespace-nowrap text-highlight">
                    {t.more}
                  </span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Add a person */}
        <div className="orbit-item group/o contents">
          <OrbitLine m={M.add} d={D.add} faint />
          <div style={placeVars(M.add, D.add)} className={cn(PLACED, "transition-opacity duration-300")}>
            <div className="size-full motion-safe:animate-drift-b" style={{ animationDelay: "-6s" }}>
              <Link
                href="/people/new"
                aria-label={mn.people.add}
                className="relative flex size-full items-center justify-center rounded-full border-2 border-dashed border-highlight bg-tint-1 text-highlight transition-[scale,rotate] duration-500 ease-[cubic-bezier(.2,.9,.25,1.3)] group-hover/o:scale-115 group-hover/o:rotate-90"
              >
                <Plus className="size-6" aria-hidden />
              </Link>
            </div>
            <span className="pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 text-[13px] font-semibold whitespace-nowrap text-highlight">
              {mn.home.add}
            </span>
          </div>
        </div>

        {/* Me: avatar with my name; on phones also sign and birth date (desktop has them aside) */}
        <div className={cn("orbit-me", PLACED, "z-10")}>
          <Link
            href={`/people/${self.id}`}
            aria-label={t.meAria(self.name, self.signName)}
            className="group/me block size-full motion-safe:animate-breathe"
          >
            <span
              className="block size-full overflow-hidden rounded-full border-4 border-fg bg-surface transition-[scale] duration-500 ease-[cubic-bezier(.2,.9,.25,1.3)] group-hover/me:scale-105"
              style={{
                boxShadow:
                  "0 0 0 10px color-mix(in oklab, var(--highlight) 14%, transparent), 0 0 0 24px color-mix(in oklab, var(--highlight) 6%, transparent), 0 16px 40px rgb(0 0 0 / 0.16)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URI */}
              <img
                src={avatarDataUri(self.avatarSeed)}
                alt=""
                className="size-full dark:invert"
              />
            </span>
            <span className="absolute top-full left-1/2 flex -translate-x-1/2 -translate-y-[18px] flex-col items-center gap-1">
              <span className="max-w-40 truncate rounded-full bg-fg px-3.5 py-1 font-heading text-lg leading-tight font-semibold text-bg lg:max-w-52 lg:text-xl">
                {self.name}
              </span>
              <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium whitespace-nowrap tabular-nums lg:hidden">
                {self.signName} · {self.birthDate}
              </span>
              <ProductIcons codes={own} products={products} />
            </span>
          </Link>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-12 z-20 hidden w-[340px] flex-col justify-center gap-3 lg:flex [&_a]:pointer-events-auto">
        {aside}
      </div>
    </section>
  );
}
