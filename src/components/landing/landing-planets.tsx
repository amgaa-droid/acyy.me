"use client";

import { ArrowRight, ChevronDown, Lock, Sparkles } from "lucide-react";
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
  captionBodies,
  chainPoint,
  clampToStage,
  dropTarget,
  fitRing,
  layoutScale,
  rimLine,
  ringAngles,
  scatter,
  toPct,
  toPx,
  type Body,
  type PlanetLayout,
  type Point,
} from "@/lib/planet-system";
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

/** The landing stage leaves room at the top for the headline. */
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
export type DemoPerson = { id: string; name: string; avatarUri: string; tint: string };

type Sheet = { kind: "reveal" } | { kind: "product"; code: string; who: string } | { kind: "pair"; who: string };

type Drag = { id: string; sx: number; sy: number; ox: number; oy: number; x: number; y: number; moved: boolean; target: boolean };

function Glyph({ icon, className }: { icon: string; className?: string }) {
  const Icon = PRODUCT_ICON_COMPONENTS[icon as ProductIconName] ?? Sparkles;
  return <Icon className={className} strokeWidth={1.8} aria-hidden />;
}

const loginTo = (next: string) => `/login?${new URLSearchParams({ next })}`;

/**
 * The signed-out landing's first screen, in the same planet-system look as the signed-in home:
 * "Та" in the middle (tap: pick your birthday for the free teaser), example people around it
 * (tap: their readings; each opens a sheet that leads to sign-in), drag one onto "Та" to see
 * what a pair reading is.
 */
export function LandingPlanets({
  appName,
  people,
  products,
  synastry,
  birthdayPrice,
}: {
  appName: string;
  people: DemoPerson[];
  products: LandingProduct[];
  synastry: { price: number } | null;
  birthdayPrice: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [places, setPlaces] = useState<Record<string, Point>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
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
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = size && size.w >= 1024 ? LANDING_DESKTOP : LANDING_PHONE;
  const k = size ? layoutScale(layout, size.w, size.h) : 1;
  const radius = (i: number) => layout.sizes[Math.min(i, layout.sizes.length - 1)] * k;

  // A fresh random sky on every visit; re-scattered when the screen changes shape.
  const sizeKey = size ? `${layout === LANDING_DESKTOP}` : "";
  useEffect(() => {
    if (!size) return;
    const me = { ...toPx(layout.me, size.w, size.h), r: layout.me.r * k };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- places depend on the measured screen
    setPlaces(
      scatter(
        people.map((p, i) => ({ id: p.id, r: radius(i) })),
        [me, ...captionBodies(me, 210)],
        size.w,
        size.h,
        layout,
      ),
    );
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
      <div aria-hidden className="absolute inset-0" onClick={() => setSelected(null)} />
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

      <div className="pointer-events-none absolute inset-x-0 top-20 z-30 mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 text-center lg:top-28">
        <span className="flex items-center gap-1.5 rounded-full bg-surface/80 px-3 py-1.5 text-xs font-semibold text-highlight">
          <Sparkles className="size-3.5" aria-hidden /> {t.hero.eyebrow}
        </span>
        <h1 className="font-heading text-[34px] leading-[1.05] font-semibold text-balance lg:text-6xl">
          {t.hero.title}
        </h1>
        <p className="hidden max-w-xl text-muted-foreground lg:block lg:text-lg">{t.hero.subtitle}</p>
      </div>

      {size && renderStage()}

      <p className="pointer-events-none absolute bottom-16 left-1/2 z-20 max-w-[calc(100%-2rem)] -translate-x-1/2 truncate rounded-full bg-surface/70 px-4 py-2 text-center text-[13px] text-muted-foreground">
        {drag?.moved && drag.target ? tp.dropOn : tp.hint}
      </p>
      <a
        href="#more"
        className="absolute bottom-3 left-1/2 z-20 flex h-11 -translate-x-1/2 items-center gap-1 rounded-full px-4 text-sm font-semibold text-highlight"
      >
        {tp.scroll} <ChevronDown className="size-4 motion-safe:animate-bounce" aria-hidden />
      </a>

      <BottomSheet
        title={
          sheet?.kind === "reveal"
            ? t.reveal.title
            : sheet?.kind === "pair"
              ? t.synastry.title
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
              href={loginTo(`/buy/${sheetProduct.code}`)}
              className="flex h-13 items-center justify-center gap-2 rounded-full bg-fg px-6 font-semibold text-bg"
            >
              {tp.openWith(formatMnt(sheetProduct.price))} <ArrowRight className="size-4.5" aria-hidden />
            </Link>
          </div>
        )}
        {sheet?.kind === "pair" && (
          <div className="flex flex-col gap-4">
            <p className="text-base leading-relaxed">{t.synastry.body}</p>
            <ul className="flex flex-wrap gap-2">
              {t.synastry.points.map((point) => (
                <li key={point} className="rounded-full bg-subtle px-3 py-1.5 text-sm font-medium">
                  {point}
                </li>
              ))}
            </ul>
            {synastry && (
              <Link
                href={loginTo("/buy/synastry")}
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
    const me: Body = { ...toPx(layout.me, w, h), r: layout.me.r * k };
    const home = new Map<string, Body>([[YOU, me]]);
    people.forEach((p, i) => {
      if (places[p.id]) home.set(p.id, { ...toPx(places[p.id], w, h), r: radius(i) });
    });
    const pos = (id: string) => {
      const b = home.get(id)!;
      return drag?.moved && drag.id === id ? { x: drag.x, y: drag.y, r: b.r } : b;
    };
    const sel = selected && home.has(selected) && !drag?.moved ? selected : null;
    const center = { x: w / 2, y: h * 0.6 };
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
          style={{ left: me.x, top: me.y, width: me.r * 7.8, height: me.r * 7.8 }}
        />

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
                        `relative block size-full overflow-hidden rounded-full border-[3px] border-surface shadow-[0_8px_24px_rgb(0_0_0/0.14)] transition-[scale] duration-500 ${SPRING} group-hover/p:scale-108 dark:bg-nav`,
                        p.tint,
                        selected === p.id && "shadow-[0_0_0_5px_var(--bg),0_0_0_8px_var(--highlight)]",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- local data URI */}
                      <img src={p.avatarUri} alt="" draggable={false} className="size-full" />
                    </span>
                    <span className="pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 text-[13px] font-semibold whitespace-nowrap lg:text-[15px]">
                      {p.name}
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
              {tp.pickBirthday} <ArrowRight className="size-4" aria-hidden />
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
