"use client";

import { ArrowRight, ChevronDown, HeartHandshake, Lock, Sparkles, X } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { BottomSheet } from "@/components/app/bottom-sheet";
import { BrandMark } from "@/components/app/brand-mark";
import { BirthdayReveal } from "@/components/landing/birthday-reveal";
import { PRODUCT_ICON_COMPONENTS } from "@/components/readings/product-icon";
import { formatMnt, mn } from "@/i18n/mn";
import type { ProductIconName } from "@/lib/domain";
import {
  DESKTOP_LAYOUT,
  PHONE_LAYOUT,
  chainPoint,
  clampToStage,
  dropTarget,
  fitRing,
  layoutScale,
  rimLine,
  ringAngles,
  toPct,
  toPx,
  type Body,
  type PlanetLayout,
  type Point,
} from "@/lib/planet-system";
import { chipCentre, orderByLinks, ringSeats } from "@/lib/landing-seats";
import { cn } from "@/lib/utils";

const t = mn.landing;
const tp = mn.landing.planets;
const YOU = "you";
const SPRING = "ease-[cubic-bezier(.2,.9,.25,1.3)]";
const DRIFT = ["motion-safe:animate-drift-a", "motion-safe:animate-drift-b", "motion-safe:animate-drift-c"];
const STARS = [
  { x: 30, y: 9, d: 0 },
  { x: 72, y: 14, d: 1.2 },
  { x: 88, y: 40, d: 2.2 },
  { x: 8, y: 34, d: 0.6 },
  { x: 18, y: 84, d: 1.8 },
  { x: 55, y: 93, d: 2.8 },
  { x: 94, y: 66, d: 0.9 },
];
const LABEL_W = 112;
/** On a phone the first screen shows at most this many example people, and links between them. */
const PHONE_PEOPLE = 4;
const PHONE_LINKS = 2;
/** The outer orbit's diameter, in "Та" radii; seats stay round it. */
const OUTER_ORBIT = 7.8;
/** Below this height the headline shrinks (the `short` variant in globals.css). */
const SHORT_H = 760;
/** Hint line + "Дэлгэрэнгүй" at the bottom of the first screen (px). */
const HINT_ROOM = 104;

/** Fallback seats' room for the headline; random seats use the measured headline instead. */
const LANDING_PHONE: PlanetLayout = {
  ...PHONE_LAYOUT,
  me: { x: 50, y: 60, r: 58 },
  safe: { top: 230, bottom: 96, side: 10 },
};
const LANDING_DESKTOP: PlanetLayout = {
  ...DESKTOP_LAYOUT,
  me: { x: 50, y: 60, r: 88 },
  safe: { top: 250, bottom: 96, side: 40 },
};

export type LandingProduct = { code: string; name: string; icon: string; price: number; hook: string };
export type DemoPerson = {
  id: string;
  name: string;
  avatarUri: string;
  tint: string;
  /** "1968.03.05" */
  birthDate: string;
  signName: string;
};
export type DemoLink = {
  id: string;
  a: string;
  b: string;
  goodFor: string[];
  cautionFor: string[];
  text: string;
};
/** CMS copy for the first screen (src/lib/landing-content.ts), tokens already filled. */
export type PlanetsCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  pickBirthday: string;
  hint: string;
  goodLabel: string;
  cautionLabel: string;
  example: string;
  cta: string;
  pairTitle: string;
  pairBody: string;
  pairPoints: string[];
};

/**
 * Fixed seats for up to 5 example people, % of the stage (phone / desktop): the fallback when
 * random seats don't fit (a very short screen). Neighbouring seats are close together so links
 * between them don't cross "Та"; the CMS orders people into them.
 */
const SEATS: { phone: Point; desktop: Point }[] = [
  { phone: { x: 20, y: 41 }, desktop: { x: 22, y: 44 } },
  { phone: { x: 78, y: 37 }, desktop: { x: 76, y: 40 } },
  { phone: { x: 86, y: 55 }, desktop: { x: 86, y: 62 } },
  { phone: { x: 80, y: 76 }, desktop: { x: 66, y: 78 } },
  { phone: { x: 20, y: 72 }, desktop: { x: 30, y: 78 } },
];

type Sheet = { kind: "reveal" } | { kind: "product"; code: string; who: string } | { kind: "pair"; who: string };

type Drag = { id: string; sx: number; sy: number; ox: number; oy: number; x: number; y: number; moved: boolean; target: boolean };

function Glyph({ icon, className }: { icon: string; className?: string }) {
  const Icon = PRODUCT_ICON_COMPONENTS[icon as ProductIconName] ?? Sparkles;
  return <Icon className={className} strokeWidth={1.8} aria-hidden />;
}

const INFO_W = 280;

/**
 * The signed-out landing's first screen, in the same planet-system look as the signed-in home:
 * "Та" in the middle (tap: pick your birthday for the free teaser), example people around it
 * (tap: their readings; each opens a sheet that leads to sign-in), drag one onto "Та" to see
 * what a pair reading is.
 */
export function LandingPlanets({
  appName,
  copy,
  people: allPeople,
  links: allLinks,
  products,
  synastry,
  birthdayPrice,
}: {
  appName: string;
  copy: PlanetsCopy;
  people: DemoPerson[];
  links: DemoLink[];
  products: LandingProduct[];
  synastry: { price: number } | null;
  birthdayPrice: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  /** `titleBottom`: where the headline block ends, so the stage starts below it. */
  const [size, setSize] = useState<{ w: number; h: number; titleBottom: number } | null>(null);
  const [places, setPlaces] = useState<Record<string, Point>>({});
  /** People are drawn smaller when the random seats only fit that way (short screens). */
  const [seatScale, setSeatScale] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [intro, setIntro] = useState(true);
  const [drag, setDragState] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const setDrag = (d: Drag | null) => {
    dragRef.current = d;
    setDragState(d);
  };

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const title = titleRef.current;
      const titleBottom = title ? title.offsetTop + title.offsetHeight : 0;
      setSize({ w: el.clientWidth, h: el.clientHeight, titleBottom });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (titleRef.current) ro.observe(titleRef.current);
    return () => ro.disconnect();
  }, []);

  const desktop = !!size && size.w >= 1024;
  // Phones: fewer example people and links, so names and link chips don't pile up.
  const people = desktop ? allPeople : allPeople.slice(0, PHONE_PEOPLE);
  const links = allLinks
    .filter((l) => people.some((p) => p.id === l.a) && people.some((p) => p.id === l.b))
    .slice(0, desktop ? undefined : PHONE_LINKS);
  const short = !!size && size.h < SHORT_H;
  const base = desktop ? LANDING_DESKTOP : LANDING_PHONE;
  const k = size ? layoutScale(base, size.w, size.h) : 1;
  const baseRadius = (i: number) => base.sizes[Math.min(i, base.sizes.length - 1)] * k;
  const radius = (i: number) => baseRadius(i) * seatScale;
  // The stage: from below the headline down to the hint line ("Та" in its middle).
  const bandTop = size ? Math.max(size.titleBottom + 8, 72) : base.safe.top;
  const bandBottom = size ? size.h - HINT_ROOM : 0;
  const meR = base.me.r * k;
  const meY = size
    ? Math.min(size.h - HINT_ROOM - meR - 30, Math.max(bandTop + meR + 16, (bandTop + bandBottom) / 2 - 11))
    : 0;
  const layout: PlanetLayout = { ...base, safe: { ...base.safe, top: bandTop } };

  // Random seats round "Та" on every visit (linked people side by side); fixed seats when they
  // don't fit. Redrawn when the screen changes shape or the headline wraps differently.
  const sizeKey = size ? `${desktop}|${Math.round(size.titleBottom / 24)}` : "";
  useEffect(() => {
    if (!size) return;
    const { w, h } = size;
    const index = new Map(people.map((p, i) => [p.id, i]));
    const order = orderByLinks(
      people.map((p) => p.id),
      links,
    );
    const stage = {
      w,
      h,
      top: bandTop,
      bottom: bandBottom,
      side: base.safe.side,
      me: { x: w / 2, y: meY, r: meR },
      keepOut: desktop ? 36 : 22,
      // "Төрсөн өдрөө сонго" hangs 18px into the bottom of "Та" (see the markup below).
      pill: { w: desktop ? 220 : 210, h: 38, dy: meR - 18 },
      // People stay round the outer orbit instead of drifting to the screen edges.
      reach: (meR * OUTER_ORBIT) / 2,
    };
    const pairs = links.map((l) => [l.a, l.b] as const);
    // Tight screens: smaller people first, then a wider orbit, before giving up on random seats.
    let random: Record<string, Point> | null = null;
    let scale = 1;
    const seatsAt = (s: number, reach: number, withChips: boolean) =>
      ringSeats(
        order.map((id) => ({ id, r: baseRadius(index.get(id)!) * s })),
        { ...stage, reach },
        withChips ? pairs : [],
      );
    search: for (const wider of [1, 1.25, 1.6])
      for (const s of [1, 0.86, 0.74]) {
        random = seatsAt(s, stage.reach * wider, true);
        scale = s;
        if (random) break search;
      }
    // Last resort before the fixed seats: let link chips touch the people.
    random ??= seatsAt(scale, Infinity, false);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- places depend on the measured screen
    setSeatScale(random ? scale : 1);
    setPlaces(
      Object.fromEntries(
        people.map((p, i) => {
          if (random) return [p.id, toPct(random[p.id], w, h)];
          const seat = SEATS[i % SEATS.length];
          const at = toPx(desktop ? seat.desktop : seat.phone, w, h);
          return [p.id, toPct(clampToStage(at, baseRadius(i), w, h, layout), w, h)];
        }),
      ),
    );
    setInfo(null);
    const id = window.setTimeout(() => setIntro(false), 1600);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scatter once per screen shape
  }, [sizeKey]);

  const nameOf = (id: string) => (id === YOU ? tp.you : (people.find((p) => p.id === id)?.name ?? ""));
  const sheetProduct = sheet?.kind === "product" ? products.find((p) => p.code === sheet.code) : null;

  return (
    <section
      ref={rootRef}
      id="top"
      aria-label={tp.label}
      className="relative h-dvh min-h-[560px] touch-pan-y overflow-hidden bg-tint-1 select-none"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        onClick={() => {
          setSelected(null);
          setInfo(null);
        }}
      />
      {STARS.map((s) => (
        <span
          key={`${s.x}-${s.y}`}
          aria-hidden
          className="pointer-events-none absolute size-1 rounded-full bg-highlight motion-safe:animate-twinkle"
          style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s` }}
        />
      ))}

      <header className="absolute inset-x-0 top-0 z-40 mx-auto flex h-16 max-w-6xl items-center justify-between px-4 pt-[env(safe-area-inset-top)] lg:h-20 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark className="size-7 text-highlight" />
          <span className="font-heading text-2xl font-semibold">{appName}</span>
        </Link>
        <Link href="/login" className="flex h-11 items-center rounded-full bg-fg px-5 text-sm font-semibold text-bg">
          {t.login}
        </Link>
      </header>

      {/* Positions are also inline: with a stale stylesheet these blocks would pile up at the top. */}
      <div
        ref={titleRef}
        className="pointer-events-none absolute inset-x-0 top-20 z-30 mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 text-center lg:top-28 short:top-18 short:max-w-4xl lg:short:top-22"
        style={size ? { top: desktop ? (short ? 88 : 112) : short ? 72 : 80 } : undefined}
      >
        {/* Short screens keep only the headline, smaller: the stage needs the height. */}
        {/* Phones: two balanced lines of plain text (a pill wrapped to two lines looked boxed in). */}
        <p className="max-w-[17rem] text-center text-[13px] leading-snug font-semibold tracking-wide text-balance text-highlight short:hidden lg:flex lg:max-w-none lg:items-center lg:gap-1.5 lg:rounded-full lg:bg-surface/80 lg:px-3 lg:py-1.5 lg:text-xs lg:tracking-normal">
          <Sparkles className="mr-1 inline size-3.5 -translate-y-px align-middle lg:mr-0" aria-hidden />
          {/* No line break after the hyphen of "Astrology-ийн". */}
          {copy.eyebrow.replace(/-/g, "\u2011")}
        </p>
        <h1 className="font-heading text-[34px] leading-[1.05] font-semibold text-balance short:text-[28px] lg:text-6xl lg:short:text-5xl">
          {copy.title}
        </h1>
        {copy.subtitle && (
          <p className="hidden max-w-xl text-muted-foreground short:hidden lg:block lg:text-lg">{copy.subtitle}</p>
        )}
      </div>

      {size && renderStage()}

      <p
        className="pointer-events-none absolute bottom-16 left-1/2 z-20 max-w-[calc(100%-2rem)] -translate-x-1/2 truncate rounded-full bg-surface/70 px-4 py-2 text-center text-[13px] text-muted-foreground"
        style={{ bottom: 64 }}
      >
        {drag?.moved && drag.target ? tp.dropOn : copy.hint}
      </p>
      <a
        href="#more"
        className="absolute bottom-3 left-1/2 z-20 flex h-11 -translate-x-1/2 items-center gap-1 rounded-full px-4 text-sm font-semibold text-highlight"
        style={{ bottom: 12 }}
      >
        {tp.scroll} <ChevronDown className="size-4 motion-safe:animate-bounce" aria-hidden />
      </a>

      <BottomSheet
        title={
          sheet?.kind === "reveal"
            ? t.reveal.title
            : sheet?.kind === "pair"
              ? copy.pairTitle
              : (sheetProduct?.name ?? "")
        }
        open={!!sheet}
        onOpenChange={(open) => !open && setSheet(null)}
      >
        {sheet?.kind === "reveal" && <BirthdayReveal price={birthdayPrice} />}
        {sheet?.kind === "product" && sheetProduct && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-tint-1 text-highlight">
                <Glyph icon={sheetProduct.icon} className="size-6" />
              </span>
              <span className="text-sm text-muted-foreground">{nameOf(sheet.who)}</span>
            </div>
            <p className="text-base leading-relaxed">{sheetProduct.hook}</p>
            <Link
              href="/login"
              className="flex h-13 items-center justify-center gap-2 rounded-full bg-fg px-6 font-semibold text-bg"
            >
              {tp.openWith(formatMnt(sheetProduct.price))} <ArrowRight className="size-4.5" aria-hidden />
            </Link>
          </div>
        )}
        {sheet?.kind === "pair" && (
          <div className="flex flex-col gap-4">
            <p className="text-base leading-relaxed">{copy.pairBody}</p>
            <ul className="flex flex-wrap gap-2">
              {copy.pairPoints.map((point) => (
                <li key={point} className="rounded-full bg-subtle px-3 py-1.5 text-sm font-medium">
                  {point}
                </li>
              ))}
            </ul>
            {synastry && (
              <Link
                href="/login"
                className="flex h-13 items-center justify-center gap-2 rounded-full bg-fg px-6 font-semibold text-bg"
              >
                {tp.openWith(formatMnt(synastry.price))} <ArrowRight className="size-4.5" aria-hidden />
              </Link>
            )}
          </div>
        )}
      </BottomSheet>
    </section>
  );

  function renderStage() {
    const { w, h } = size!;
    const me: Body = { x: w / 2, y: meY, r: meR };
    const home = new Map<string, Body>([[YOU, me]]);
    people.forEach((p, i) => {
      if (places[p.id]) home.set(p.id, { ...toPx(places[p.id], w, h), r: radius(i) });
    });
    const pos = (id: string) => {
      const b = home.get(id)!;
      return drag?.moved && drag.id === id ? { x: drag.x, y: drag.y, r: b.r } : b;
    };
    const sel = selected && home.has(selected) && !drag?.moved ? selected : null;
    const center = { x: me.x, y: me.y };
    const button = layout.ring.button * Math.min(1, k);
    const edge = button / 2 + 8;
    const ringR = sel ? home.get(sel)!.r + layout.ring.gap * Math.min(1, k) : 0;
    const items = sel === YOU ? [] : products;
    const angles = sel
      ? fitRing(home.get(sel)!, ringR, ringAngles(home.get(sel)!, center, items.length, false, layout.ring.step), {
          left: edge,
          top: edge + 64,
          right: w - edge,
          bottom: h - edge - 90,
        })
      : [];

    const onDown = (id: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      const b = home.get(id)!;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ id, sx: e.clientX, sy: e.clientY, ox: e.clientX - b.x, oy: e.clientY - b.y, x: b.x, y: b.y, moved: false, target: false });
    };
    const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
      const d = dragRef.current;
      if (!d) return;
      const moved = d.moved || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6;
      const x = e.clientX - d.ox;
      const y = e.clientY - d.oy;
      const target = moved && dropTarget({ x, y, r: home.get(d.id)!.r }, [{ id: YOU, body: me }]) === YOU;
      setDrag({ ...d, moved, x, y, target });
    };
    const onUp = () => {
      const d = dragRef.current;
      if (!d) return;
      setDrag(null);
      setInfo(null);
      if (!d.moved) return setSelected((cur) => (cur === d.id ? null : d.id));
      if (d.target) return setSheet({ kind: "pair", who: d.id });
      const r = home.get(d.id)!.r;
      setPlaces((cur) => ({ ...cur, [d.id]: toPct(clampToStage({ x: d.x, y: d.y }, r, w, h, layout), w, h) }));
    };

    const ringLabel = (a: number, x: number, text: string, y: number) => {
      const labelW = Math.min(LABEL_W, text.length * 6.6 + 22);
      const reach = button / 2 + 6;
      const cx = Math.min(w - 8 - labelW / 2, Math.max(8 + labelW / 2, x + Math.cos(a) * (reach + labelW / 2)));
      const cy = y + Math.sin(a) * (reach + 11);
      return (
        <span
          className="pointer-events-none absolute max-w-28 -translate-1/2 truncate rounded-full bg-surface px-2.5 py-1 text-xs leading-none font-semibold whitespace-nowrap shadow-[0_1px_4px_rgb(0_0_0/0.08)]"
          style={{ left: `calc(50% + ${cx - x}px)`, top: `calc(50% + ${cy - y}px)` }}
        >
          {text}
        </span>
      );
    };

    const personOf = (id: string) => people.find((p) => p.id === id)!;

    function renderLinks() {
      return links.map((l) => {
        const a = home.get(l.a);
        const b = home.get(l.b);
        if (!a || !b) return null;
        const line = rimLine(a, b);
        // Same spot the seats were checked against (off both captions).
        const mid = chipCentre(a, b);
        const key = l.id;
        const open = info === key;
        const pa = personOf(l.a);
        const pb = personOf(l.b);
        const left = Math.min(w - INFO_W / 2 - 8, Math.max(INFO_W / 2 + 8, mid.x));
        const below = mid.y < h * 0.55;
        return (
          <div key={key}>
            <span
              aria-hidden
              className="pointer-events-none absolute planet-line planet-line-ghost opacity-60"
              style={{ left: line.x, top: line.y - 1, width: line.length, transform: `rotate(${line.angle}deg)` }}
            />
            <button
              type="button"
              aria-label={tp.linkAria(pa.name, pb.name)}
              aria-expanded={open}
              onClick={() => {
                setSelected(null);
                setInfo(open ? null : key);
              }}
              className="group/l absolute z-20 flex h-11 min-w-11 -translate-1/2 items-center justify-center"
              style={{ left: mid.x, top: mid.y }}
            >
              <span
                className={cn(
                  `flex max-w-28 items-center gap-1 truncate rounded-full p-2 text-xs lg:px-2.5 lg:py-1 font-semibold whitespace-nowrap shadow-[0_4px_12px_rgb(0_0_0/0.12)] transition-[scale] duration-300 ${SPRING} group-hover/l:scale-110`,
                  open ? "bg-fg text-bg" : "bg-surface text-highlight",
                )}
              >
                <HeartHandshake className="size-3.5 shrink-0" aria-hidden />
                {/* Phones: just the icon (the name is in the card it opens). */}
                {l.goodFor[0] && <span className="hidden truncate lg:inline">{l.goodFor[0]}</span>}
              </span>
            </button>
            {open && (
              <div
                role="dialog"
                aria-label={tp.linkAria(pa.name, pb.name)}
                className={cn(
                  "absolute z-40 flex -translate-x-1/2 animate-pop-in flex-col gap-3 rounded-3xl bg-surface p-4 text-left shadow-[0_18px_44px_rgb(0_0_0/0.18)]",
                  below ? "mt-6" : "-mt-6 -translate-y-full",
                )}
                style={{ left, top: mid.y, width: INFO_W }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full bg-subtle px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                    {copy.example}
                  </span>
                  <button
                    type="button"
                    aria-label={tp.close}
                    onClick={() => setInfo(null)}
                    className="-mt-2 -mr-2 flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-subtle"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span>
                    {pa.name} <span className="font-normal text-muted-foreground">· {pa.signName}</span>
                  </span>
                  <HeartHandshake className="size-4 shrink-0 text-highlight" aria-hidden />
                  <span>
                    {pb.name} <span className="font-normal text-muted-foreground">· {pb.signName}</span>
                  </span>
                </div>
                <Chips label={copy.goodLabel} items={l.goodFor} tone="bg-tint-3" />
                <Chips label={copy.cautionLabel} items={l.cautionFor} tone="bg-tint-2" />
                {l.text && <p className="text-sm leading-relaxed">{l.text}</p>}
                {synastry && (
                  <Link
                    href="/login"
                    className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-fg px-4 text-sm font-semibold text-bg"
                  >
                    {copy.cta} · {formatMnt(synastry.price)}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                )}
              </div>
            )}
          </div>
        );
      });
    }

    const selBody = sel && sel !== YOU ? pos(sel) : null;
    const ghost = drag?.moved && drag.target ? pos(drag.id) : null;

    return (
      <>
        <span
          aria-hidden
          className="pointer-events-none absolute -translate-1/2 rounded-full border-[1.5px] border-dashed border-highlight/25 motion-safe:animate-orbit-spin"
          style={{ left: me.x, top: me.y, width: me.r * 4.6, height: me.r * 4.6 }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -translate-1/2 rounded-full border border-highlight/15"
          style={{ left: me.x, top: me.y, width: me.r * OUTER_ORBIT, height: me.r * OUTER_ORBIT }}
        />

        {!sel && !drag?.moved && renderLinks()}

        {(selBody || ghost) &&
          (() => {
            const b = (ghost ?? selBody)!;
            const l = rimLine(me, b);
            const c = chainPoint(me, b);
            return (
              <>
                <span
                  aria-hidden
                  className={cn("pointer-events-none absolute planet-line", ghost && "planet-line-ghost motion-safe:animate-line-flow")}
                  style={{ left: l.x, top: l.y - 1, width: l.length, transform: `rotate(${l.angle}deg)` }}
                />
                {!ghost && sel && (
                  <button
                    type="button"
                    aria-label={tp.pair(nameOf(sel))}
                    onClick={() => setSheet({ kind: "pair", who: sel })}
                    className="absolute z-10 flex -translate-1/2 animate-pop-in items-center justify-center rounded-full border-[1.5px] border-muted-foreground/40 bg-surface text-muted-foreground transition-[scale] hover:scale-120"
                    style={{ left: c.x, top: c.y, width: layout.chain * k, height: layout.chain * k }}
                  >
                    <Lock className="size-[44%]" strokeWidth={2} aria-hidden />
                  </button>
                )}
              </>
            );
          })()}

        {people.map((p, i) => {
          if (!home.has(p.id)) return null;
          const b = pos(p.id);
          const isDrag = drag?.moved && drag.id === p.id;
          const fly = intro
            ? ({ "--fly-x": `${me.x - b.x}px`, "--fly-y": `${me.y - b.y}px`, animationDelay: `${i * 0.08}s` } as CSSProperties)
            : undefined;
          return (
            <div
              key={p.id}
              className={cn(
                "absolute -translate-1/2",
                isDrag ? "z-30" : cn(`z-10 transition-[left,top,opacity] duration-500 ${SPRING}`, sel && sel !== p.id ? "opacity-30" : "opacity-100"),
              )}
              style={{ left: b.x, top: b.y, width: b.r * 2, height: b.r * 2 }}
            >
              <div className={cn("size-full", intro && "motion-safe:animate-fly-in")} style={fly}>
                <div className={cn("size-full", !isDrag && DRIFT[i % DRIFT.length])} style={{ animationDelay: `${-i * 1.7}s` }}>
                  <button
                    type="button"
                    aria-label={tp.demoAria(p.name)}
                    aria-pressed={selected === p.id}
                    onPointerDown={onDown(p.id)}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={() => setDrag(null)}
                    onClick={(e) => {
                      if (e.detail === 0) setSelected((cur) => (cur === p.id ? null : p.id));
                    }}
                    className="group/p relative block size-full cursor-grab touch-none rounded-full"
                  >
                    <span
                      className={cn(
                        `relative block size-full overflow-hidden rounded-full border-[3px] border-surface shadow-[0_8px_24px_rgb(0_0_0/0.14)] transition-[scale] duration-500 ${SPRING} group-hover/p:scale-108 dark:bg-face`,
                        p.tint,
                        selected === p.id && "shadow-[0_0_0_5px_var(--bg),0_0_0_8px_var(--highlight)]",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- local data URI */}
                      <img src={p.avatarUri} alt="" draggable={false} className="size-full" />
                    </span>
                    <span className="pointer-events-none absolute top-full left-1/2 mt-1 flex -translate-x-1/2 flex-col items-center rounded-xl bg-tint-1/85 px-2 py-0.5 leading-tight whitespace-nowrap">
                      <span className="text-[13px] font-semibold lg:text-[15px]">{p.name}</span>
                      <span className="text-[11px] text-muted-foreground lg:text-xs">
                        {p.signName}
                        <span className="hidden lg:inline"> · {p.birthDate}</span>
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Та */}
        <div className="absolute z-[16] -translate-1/2" style={{ left: me.x, top: me.y, width: me.r * 2, height: me.r * 2 }}>
          <button
            type="button"
            aria-label={tp.youAria}
            onClick={() => {
              setSelected(null);
              setInfo(null);
              setSheet({ kind: "reveal" });
            }}
            className="group/me block size-full rounded-full motion-safe:animate-breathe"
          >
            <span
              className={cn(
                `flex size-full items-center justify-center rounded-full border-4 border-fg bg-surface font-heading text-5xl font-semibold transition-[scale] duration-500 ${SPRING} group-hover/me:scale-104 lg:text-7xl dark:border-highlight`,
                drag?.target && "scale-110",
              )}
              style={{
                boxShadow:
                  "0 0 0 12px color-mix(in oklab, var(--highlight) 14%, transparent), 0 0 0 28px color-mix(in oklab, var(--highlight) 6%, transparent), 0 18px 44px rgb(0 0 0 / 0.16)",
              }}
            >
              {tp.you}
            </span>
            <span className="absolute top-full left-1/2 flex -translate-x-1/2 -translate-y-[18px] items-center gap-1.5 rounded-full bg-fg px-4 py-2 text-sm font-semibold whitespace-nowrap text-bg">
              {copy.pickBirthday} <ArrowRight className="size-4" aria-hidden />
            </span>
          </button>
        </div>

        {selBody &&
          items.map((pr, i) => {
            const a = angles[i];
            const x = Math.min(w - edge, Math.max(edge, selBody.x + Math.cos(a) * ringR));
            const y = Math.min(h - edge - 90, Math.max(edge + 64, selBody.y + Math.sin(a) * ringR));
            const name = mn.home.planets.short[pr.code] ?? pr.name.replace(/ зурхай$/u, "");
            return (
              <button
                key={`${sel}-${pr.code}`}
                type="button"
                aria-label={`${pr.name} — ${nameOf(sel!)}`}
                onClick={() => setSheet({ kind: "product", code: pr.code, who: sel! })}
                className="group/r absolute z-30 -translate-1/2 animate-pop-in"
                style={{ left: x, top: y, width: button, height: button, animationDelay: `${i * 0.05}s` }}
              >
                <span
                  className={`flex size-full items-center justify-center rounded-full border-2 border-highlight/30 bg-surface text-highlight shadow-[0_8px_20px_rgb(0_0_0/0.16)] transition-[scale] duration-300 ${SPRING} group-hover/r:scale-112`}
                >
                  <Glyph icon={pr.icon} className="size-[46%]" />
                </span>
                {ringLabel(a, x, name, y)}
              </button>
            );
          })}
      </>
    );
  }
}

function Chips({ label, items, tone }: { label: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <li key={i} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", tone)}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
