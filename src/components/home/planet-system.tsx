"use client";

import { Link2, Menu, Plus, Sparkles, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { NAV_ITEMS } from "@/components/app/nav-items";
import { SignOutButton } from "@/components/app/sign-out-button";
import { WalletChip } from "@/components/app/wallet-chip";
import { PRODUCT_ICON_COMPONENTS } from "@/components/readings/product-icon";
import { mn } from "@/i18n/mn";
import type { ProductIconName } from "@/lib/domain";
import { relationTint } from "@/lib/people";
import {
  MAX_SEATS,
  arrangeLinks,
  bringIn,
  chainPoint,
  dropTarget,
  initialSeating,
  layoutScale,
  lineBetween,
  pairKey,
  pickLayout,
  ringAngles,
  toPx,
  type Body,
  type PairLink,
  type Seating,
} from "@/lib/planet-system";
import { cn } from "@/lib/utils";
import type { PlanetPerson, PlanetReading, PlanetSystemData } from "@/server/planets";

const t = mn.home.planets;
const ME = "me";

const DRIFT = [
  "motion-safe:animate-drift-a",
  "motion-safe:animate-drift-b",
  "motion-safe:animate-drift-c",
  "motion-safe:animate-drift-a",
  "motion-safe:animate-drift-c",
  "motion-safe:animate-drift-b",
];
const STARS = [
  { x: 30, y: 9, d: 0 },
  { x: 72, y: 12, d: 1.2 },
  { x: 88, y: 36, d: 2.2 },
  { x: 8, y: 30, d: 0.6 },
  { x: 18, y: 84, d: 1.8 },
  { x: 55, y: 93, d: 2.8 },
  { x: 94, y: 62, d: 0.9 },
  { x: 42, y: 34, d: 1.5 },
];
const SPRING = "ease-[cubic-bezier(.2,.9,.25,1.3)]";
/** Smallest gap between planets in the "+N" dock before it shows a "see all" link instead. */
const DOCK_MIN_STEP = 60;
/** Widest a reading button's name gets (Tailwind max-w-24). */
const LABEL_W = 96;

type Drag = {
  id: string;
  fromDock: boolean;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
  moved: boolean;
  target: string | null;
};

type Stored = { seating: Seating; links: PairLink[] };

function load(key: string): Stored | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function ProductGlyph({ icon, className }: { icon: string | undefined; className?: string }) {
  const Icon = PRODUCT_ICON_COMPONENTS[icon as ProductIconName] ?? Sparkles;
  return <Icon className={className} strokeWidth={1.8} aria-hidden />;
}

/**
 * The signed-in home: "me" in the middle of the whole screen and my people as planets around.
 * Tap a planet for its readings, drag it onto another to open their pair reading; everything
 * opens as a popup (intercepted routes). Beyond six people the rest wait in a "+N" dock.
 */
export function PlanetSystem({
  data,
  balance,
  appName,
}: {
  data: PlanetSystemData;
  balance: number;
  appName: string;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const ids = data.people.map((p) => p.id);
  const storeKey = `planets:v1:${data.me.id}`;
  const [seating, setSeating] = useState<Seating>(() => initialSeating(ids));
  const [drawn, setDrawn] = useState<PairLink[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [dockOpen, setDockOpen] = useState(false);
  const [drag, setDragState] = useState<Drag | null>(null);
  // Pointer events can arrive before React re-renders (a quick tap), so handlers read the ref.
  const dragRef = useRef<Drag | null>(null);
  const setDrag = (d: Drag | null) => {
    dragRef.current = d;
    setDragState(d);
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const [foldedFor, setFoldedFor] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Seating and hand-drawn pairs live in this browser only.
  const idsKey = ids.join(",");
  useEffect(() => {
    const saved = load(storeKey);
    const known = new Set(idsKey.split(","));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring browser-only state after mount
    setSeating(initialSeating(idsKey ? idsKey.split(",") : [], saved?.seating));
    setDrawn((saved?.links ?? []).filter((l) => known.has(l.a) && known.has(l.b)));
    setLoaded(true);
  }, [storeKey, idsKey]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storeKey, JSON.stringify({ seating, links: drawn } satisfies Stored));
    } catch {
      // Private mode or storage full: the orbit just won't remember its order.
    }
  }, [loaded, storeKey, seating, drawn]);

  const byId = new Map(data.people.map((p) => [p.id, p]));
  const nameOf = (id: string) => (id === ME ? data.me.name : (byId.get(id)?.name ?? ""));
  const seated = (id: string) => seating.seats.includes(id);
  const hidden = data.people.filter((p) => !seated(p.id));
  const showDock = dockOpen && hidden.length > 0;

  // Pairs between people: bought ones, plus the ones drawn here that aren't bought yet.
  const bought = new Set(data.pairs.map((l) => pairKey(l.a, l.b)));
  const links = [...data.pairs, ...drawn.filter((l) => !bought.has(pairKey(l.a, l.b)))];
  const pairHref = (a: string, b: string, purchaseId: string | null) => {
    if (purchaseId) return `/r/${purchaseId}`;
    if (!data.pairProduct) return null;
    const pa = a === ME ? data.me.id : a;
    const pb = b === ME ? data.me.id : b;
    return `/buy/${data.pairProduct}?a=${pa}&b=${pb}`;
  };
  const readingHref = (personId: string, r: PlanetReading) =>
    r.purchaseId ? `/r/${r.purchaseId}` : `/buy/${r.code}?a=${personId === ME ? data.me.id : personId}`;

  const root = (
    <div
      ref={rootRef}
      className="fixed inset-0 h-dvh touch-none overflow-hidden bg-tint-1 select-none"
      aria-label={t.label}
    >
      {/* Tapping empty space clears a selection or closes the dock. */}
      <div
        aria-hidden
        className="absolute inset-0"
        onClick={() => {
          setSelected(null);
          setDockOpen(false);
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
      {size && renderStage()}

      <div className="absolute top-[max(env(safe-area-inset-top),1rem)] left-4 z-40 flex items-center gap-3 lg:top-8 lg:left-8">
        <button
          type="button"
          aria-label={t.menu}
          onClick={() => setMenuOpen(true)}
          className="flex size-12 items-center justify-center rounded-full bg-fg text-bg shadow-[0_8px_20px_rgb(0_0_0/0.18)]"
        >
          <Menu className="size-5.5" aria-hidden />
        </button>
        <span className="hidden items-center gap-2 font-heading text-3xl font-semibold lg:flex">
          <BrandMark className="size-5 text-highlight" />
          {appName}
        </span>
      </div>
      <div className="absolute top-[max(env(safe-area-inset-top),1rem)] right-4 z-40 lg:top-8 lg:right-8">
        <WalletChip balance={balance} />
      </div>

      <BottomSheet title={t.menu} open={menuOpen} onOpenChange={setMenuOpen}>
        <nav aria-label="Үндсэн цэс" className="flex flex-col gap-2">
          {[...NAV_ITEMS.filter((n) => n.href !== "/home"), { href: "/wallet", label: mn.header.wallet, Icon: Wallet }].map(
            ({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-14 items-center gap-3 rounded-2xl bg-subtle px-4 text-base font-semibold"
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            ),
          )}
          <div className="pt-2">
            <SignOutButton />
          </div>
        </nav>
      </BottomSheet>

      {foldedFor && (
        <BottomSheet
          title={t.foldedTitle(nameOf(foldedFor))}
          open
          onOpenChange={(open) => !open && setFoldedFor(null)}
        >
          <ul className="flex flex-col gap-2">
            {links
              .filter((l) => (l.a === foldedFor || l.b === foldedFor) && (!seated(l.a) || !seated(l.b)))
              .map((l) => {
                const other = l.a === foldedFor ? l.b : l.a;
                const p = byId.get(other);
                const href = pairHref(l.a, l.b, l.purchaseId);
                if (!p || !href) return null;
                return (
                  <li key={pairKey(l.a, l.b)}>
                    <Link
                      href={href}
                      onClick={() => {
                        setFoldedFor(null);
                        setSeating((s) => bringIn(s, [l.a, l.b]));
                      }}
                      className="flex min-h-16 items-center gap-3 rounded-2xl bg-subtle px-3 py-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- local data URI */}
                      <img
                        src={p.avatarUri}
                        alt=""
                        className={cn("size-10 rounded-full dark:invert", relationTint(p.relation))}
                      />
                      <span className="flex flex-1 flex-col">
                        <span className="font-semibold">
                          {nameOf(foldedFor)} × {p.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {l.purchaseId ? t.bought : t.notBought}
                        </span>
                      </span>
                      <Link2
                        className={cn("size-5", l.purchaseId ? "text-ring-2" : "text-muted-foreground")}
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
          </ul>
        </BottomSheet>
      )}
    </div>
  );
  return root;

  function renderStage() {
    const { w, h } = size!;
    const layout = pickLayout(w);
    const k = layoutScale(layout, w, h);
    const me = toPx(layout.me, w, h, k);
    const usedSeats = layout.seats.slice(0, seating.seats.length);
    const moreSeat = hidden.length > 0 ? toPx(layout.seats[MAX_SEATS - 1], w, h, k) : null;
    const center = { x: w / 2, y: h / 2 };

    // The "+N" dock: hidden people in a row near the bottom, as many as fit.
    const dockY = (layout.dock.y / 100) * h;
    const step = Math.max(DOCK_MIN_STEP, Math.min(layout.dock.step * k, (w - 48) / Math.max(1, hidden.length)));
    const fit = Math.max(1, Math.floor((w - 48) / step));
    const docked = showDock ? hidden.slice(0, hidden.length > fit ? fit - 1 : fit) : [];
    const dockOverflow = showDock && hidden.length > docked.length;
    const dockCount = docked.length + (dockOverflow ? 1 : 0);
    const dockR = Math.min(layout.dock.r * k, step / 2 - 8);
    const dockX0 = w / 2 - (dockCount * step) / 2 + step / 2;

    const home = new Map<string, Body>();
    home.set(ME, me);
    seating.seats.forEach((id, i) => home.set(id, toPx(usedSeats[i], w, h, k)));
    docked.forEach((p, i) => home.set(p.id, { x: dockX0 + i * step, y: dockY, r: dockR }));
    const pos = (id: string): Body | undefined => {
      const b = home.get(id);
      if (drag?.moved && drag.id === id && b) return { x: drag.x, y: drag.y, r: b.r };
      return b;
    };
    const isShown = (id: string) => home.has(id);
    const dim = (id: string) => (selected && selected !== id ? "opacity-30" : "opacity-100");

    const { drawn: drawnLinks, folded } = arrangeLinks(links, isShown);

    const onDown = (id: string, fromDock: boolean) => (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      const b = home.get(id);
      if (!b) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({
        id,
        fromDock,
        sx: e.clientX,
        sy: e.clientY,
        ox: e.clientX - b.x,
        oy: e.clientY - b.y,
        x: b.x,
        y: b.y,
        moved: false,
        target: null,
      });
    };
    const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const moved = drag.moved || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6;
      const x = e.clientX - drag.ox;
      const y = e.clientY - drag.oy;
      const r = home.get(drag.id)?.r ?? 30;
      const others = [...home.entries()]
        .filter(([id]) => id !== drag.id)
        .map(([id, body]) => ({ id, body }));
      setDrag({ ...drag, moved, x, y, target: moved ? dropTarget({ x, y, r }, others) : null });
    };
    const onUp = () => {
      const d = dragRef.current;
      if (!d) return;
      setDrag(null);
      if (!d.moved) return tap(d.id, d.fromDock);
      if (d.target) connect(d.id, d.target);
    };
    const tap = (id: string, fromDock: boolean) => {
      if (fromDock) {
        setSeating((s) => bringIn(s, [id]));
        setDockOpen(false);
        setSelected(id);
      } else {
        setSelected((cur) => (cur === id ? null : id));
      }
    };
    const connect = (a: string, b: string) => {
      const key = pairKey(a, b);
      let href: string | null;
      if (b === ME) href = pairHref(ME, a, data.mePairs[a] ?? null);
      else {
        const existing = links.find((l) => pairKey(l.a, l.b) === key);
        if (!existing) setDrawn((cur) => [...cur, { a, b, purchaseId: null }]);
        href = pairHref(a, b, existing?.purchaseId ?? null);
      }
      setSeating((s) => bringIn(s, [a, b].filter((id) => id !== ME)));
      setDockOpen(false);
      setSelected(null);
      if (href) router.push(href, { scroll: false });
    };

    const line = (a: Body, b: Body, kind: "plain" | "on" | "ghost", faded: boolean, key: string) => {
      const l = lineBetween(a, b);
      return (
        <span
          key={key}
          aria-hidden
          className={cn(
            "pointer-events-none absolute planet-line transition-opacity duration-300",
            kind === "on" && "planet-line-on motion-safe:animate-line-flow",
            kind === "ghost" && "planet-line-ghost motion-safe:animate-line-flow",
            faded ? "opacity-25" : "opacity-100",
          )}
          style={{ left: l.x, top: l.y - 1, width: l.length, transform: `rotate(${l.angle}deg)` }}
        />
      );
    };
    const chainSize = layout.chain * k;
    const chain = (
      p: { x: number; y: number },
      on: boolean,
      faded: boolean,
      label: string,
      key: string,
      action: { href: string | null } | { onClick: () => void },
      count?: number,
    ) => {
      const cls = cn(
        "absolute z-10 flex -translate-1/2 items-center justify-center rounded-full border-[1.5px] bg-surface transition-[scale,opacity] duration-300 hover:scale-120",
        on ? "border-ring-2 text-ring-2 motion-safe:animate-ping-soft" : "border-muted-foreground/40 text-muted-foreground/70",
        faded || drag ? "opacity-25" : "opacity-100",
      );
      const style = { left: p.x, top: p.y, width: chainSize, height: chainSize };
      const body = (
        <>
          <Link2 className="size-[48%]" strokeWidth={2} aria-hidden />
          {count !== undefined && (
            <span
              className={cn(
                "absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-bg",
                on ? "bg-ring-2" : "bg-muted-foreground",
              )}
            >
              {count}
            </span>
          )}
        </>
      );
      if ("onClick" in action) {
        return (
          <button key={key} type="button" aria-label={label} onClick={action.onClick} className={cls} style={style}>
            {body}
          </button>
        );
      }
      if (!action.href) return null;
      return (
        <Link key={key} href={action.href} scroll={false} aria-label={label} className={cls} style={style}>
          {body}
        </Link>
      );
    };

    const planet = (p: PlanetPerson, seat: number | null) => {
      const b = pos(p.id)!;
      const fromDock = seat === null;
      const isDrag = drag?.moved && drag.id === p.id;
      return (
        <div
          key={p.id}
          className={cn(
            "absolute -translate-1/2",
            isDrag
              ? "z-30"
              : cn(`z-10 transition-[left,top,opacity] duration-500 ${SPRING}`, fromDock ? "z-20 animate-rise-in" : dim(p.id)),
          )}
          style={{ left: b.x, top: b.y, width: b.r * 2, height: b.r * 2 }}
        >
          <div
            className={cn("size-full", !isDrag && !fromDock && seat !== null && DRIFT[seat])}
            style={{ animationDelay: `${-(seat ?? 0) * 1.7}s` }}
          >
            <button
              type="button"
              aria-label={t.personAria(p.name, p.relationText, p.signName)}
              aria-pressed={selected === p.id}
              onPointerDown={onDown(p.id, fromDock)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={() => setDrag(null)}
              onClick={(e) => {
                if (e.detail === 0) tap(p.id, fromDock);
              }}
              className={cn("group/p relative block size-full touch-none rounded-full", isDrag ? "cursor-grabbing" : "cursor-grab")}
            >
              {seat === 1 && (
                <span
                  aria-hidden
                  className="absolute top-1/2 left-1/2 h-[42%] w-[150%] -translate-1/2 -rotate-[18deg] rounded-[50%] border-[1.5px] border-highlight/35"
                />
              )}
              <span
                className={cn(
                  `relative block size-full overflow-hidden rounded-full border-[3px] border-surface shadow-[0_8px_24px_rgb(0_0_0/0.14)] transition-[scale,box-shadow] duration-500 ${SPRING} group-hover/p:scale-108`,
                  relationTint(p.relation),
                  drag?.target === p.id && "scale-115 shadow-[0_0_0_8px_color-mix(in_oklab,var(--highlight)_25%,transparent)]",
                  selected === p.id && "shadow-[0_0_0_5px_var(--surface),0_0_0_8px_var(--highlight)]",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local data URI */}
                <img src={p.avatarUri} alt="" draggable={false} className="size-full dark:invert" />
              </span>
              <span className="pointer-events-none absolute top-full left-1/2 mt-1.5 flex w-28 -translate-x-1/2 flex-col items-center">
                <span className="max-w-full truncate text-[13px] leading-tight font-semibold lg:text-[15px]">
                  {p.name}
                </span>
                {!fromDock && (
                  <span className="max-w-full truncate text-[11px] leading-tight text-muted-foreground">
                    {p.signName}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      );
    };

    // Reading buttons around the selected planet (or me).
    const sel = selected && home.has(selected) && !drag ? selected : null;
    const selPerson = sel === ME ? null : sel ? byId.get(sel) : null;
    const selReadings = sel === ME ? data.me.readings : (selPerson?.readings ?? []);
    const selBody = sel ? home.get(sel)! : null;
    const ringButton = layout.ring.button * Math.min(1, k);
    const angles = selBody
      ? ringAngles(selBody, center, selReadings.length, sel === ME, layout.ring.step)
      : [];

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

        {/* Lines: me ↔ everyone seated, me ↔ "+N", pairs between people, folded pairs. */}
        {seating.seats.map((id) => {
          const b = pos(id);
          return b && line(me, b, data.mePairs[id] ? "on" : "plain", !!selected && selected !== ME && selected !== id, `me-${id}`);
        })}
        {moreSeat && line(me, moreSeat, "plain", !!selected, "me-more")}
        {drawnLinks.map((l) => {
          const a = pos(l.a);
          const b = pos(l.b);
          return a && b && line(a, b, l.purchaseId ? "on" : "plain", !!selected && selected !== l.a && selected !== l.b, `l-${pairKey(l.a, l.b)}`);
        })}
        {moreSeat &&
          [...folded.entries()].map(([id, ls]) => {
            const a = pos(id);
            return a && line(a, moreSeat, ls.some((l) => l.purchaseId) ? "on" : "plain", !!selected && selected !== id, `f-${id}`);
          })}
        {drag?.moved && drag.target && pos(drag.id) && line(pos(drag.id)!, home.get(drag.target)!, "ghost", false, "ghost")}

        {/* Chains */}
        {seating.seats.map((id) => {
          const b = pos(id);
          const purchaseId = data.mePairs[id] ?? null;
          return (
            b &&
            chain(chainPoint(me, b, 14 * k), !!purchaseId, !!selected && selected !== ME && selected !== id, t.pair(data.me.name, nameOf(id), !!purchaseId), `cme-${id}`, { href: pairHref(ME, id, purchaseId) })
          );
        })}
        {drawnLinks.map((l) => {
          const a = pos(l.a);
          const b = pos(l.b);
          return (
            a &&
            b &&
            chain(chainPoint(a, b), !!l.purchaseId, !!selected && selected !== l.a && selected !== l.b, t.pair(nameOf(l.a), nameOf(l.b), !!l.purchaseId), `cl-${pairKey(l.a, l.b)}`, {
              onClick: () => {
                setSeating((s) => bringIn(s, [l.a, l.b]));
                const href = pairHref(l.a, l.b, l.purchaseId);
                if (href) router.push(href, { scroll: false });
              },
            })
          );
        })}
        {moreSeat &&
          !showDock &&
          [...folded.entries()].map(([id, ls]) => {
            const a = pos(id);
            return (
              a &&
              chain(chainPoint(a, moreSeat), ls.some((l) => l.purchaseId), !!selected && selected !== id, t.folded(nameOf(id), ls.length), `cf-${id}`, { onClick: () => setFoldedFor(id) }, ls.length)
            );
          })}

        {/* Planets */}
        {seating.seats.map((id, i) => {
          const p = byId.get(id);
          return p && planet(p, i);
        })}

        {moreSeat && (
          <div
            className={cn("absolute z-20 -translate-1/2 transition-opacity duration-300", selected ? "opacity-30" : "opacity-100")}
            style={{ left: moreSeat.x, top: moreSeat.y, width: moreSeat.r * 2, height: moreSeat.r * 2 }}
          >
            <div className="size-full motion-safe:animate-drift-a" style={{ animationDelay: "-4s" }}>
              <button
                type="button"
                aria-label={showDock ? t.closeDock : t.moreAria(hidden.length)}
                aria-expanded={showDock}
                onClick={() => {
                  setSelected(null);
                  setDockOpen((o) => !o);
                }}
                className={cn(
                  `relative flex size-full items-center justify-center rounded-full border-[3px] border-surface font-heading text-xl font-semibold text-bg shadow-[0_8px_24px_rgb(0_0_0/0.18)] transition-[scale] duration-500 ${SPRING} hover:scale-110 lg:text-2xl`,
                  showDock ? "bg-highlight" : "bg-fg",
                )}
              >
                {showDock ? <X className="size-6" aria-hidden /> : `+${hidden.length}`}
                <span className="absolute top-full left-1/2 mt-1.5 -translate-x-1/2 font-sans text-[13px] font-semibold whitespace-nowrap text-highlight">
                  {t.more}
                </span>
              </button>
            </div>
          </div>
        )}

        {showDock && (
          <>
            <div
              role="region"
              aria-label={t.dockTitle(hidden.length)}
              className="absolute z-[15] -translate-x-1/2 animate-rise-in rounded-[36px] bg-surface/85 shadow-[0_-10px_40px_rgb(0_0_0/0.14)] backdrop-blur-md"
              style={{
                left: w / 2,
                top: dockY - dockR - 40,
                width: Math.min(w - 32, dockCount * step + 48),
                height: dockR * 2 + 76,
              }}
            >
              <p className="absolute top-3.5 left-6 text-xs font-semibold text-highlight">{t.dockTitle(hidden.length)}</p>
            </div>
            {docked.map((p) => planet(p, null))}
            {dockOverflow && (
              <Link
                href="/people"
                className="absolute z-20 flex -translate-1/2 animate-rise-in items-center justify-center rounded-full bg-fg text-sm font-semibold text-bg"
                style={{ left: dockX0 + docked.length * step, top: dockY, width: dockR * 2, height: dockR * 2 }}
              >
                {mn.home.all}
              </Link>
            )}
          </>
        )}

        <div
          className={cn("absolute z-10 -translate-1/2 transition-opacity duration-300", selected || showDock ? "opacity-30" : "opacity-100")}
          style={(() => {
            const a = toPx(layout.add, w, h, k);
            return { left: a.x, top: a.y, width: a.r * 2, height: a.r * 2 } as CSSProperties;
          })()}
        >
          <div className="size-full motion-safe:animate-drift-b" style={{ animationDelay: "-6s" }}>
            <Link
              href="/people/new"
              scroll={false}
              aria-label={mn.people.add}
              className={`group/add relative flex size-full items-center justify-center rounded-full border-2 border-dashed border-highlight text-highlight transition-[scale,rotate] duration-500 ${SPRING} hover:scale-110 hover:rotate-90`}
            >
              <Plus className="size-6" aria-hidden />
            </Link>
            <span className="pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 text-[13px] font-semibold whitespace-nowrap text-highlight">
              {mn.people.add}
            </span>
          </div>
        </div>

        {/* Me */}
        <div className={cn("absolute z-[16] -translate-1/2 transition-opacity duration-300", dim(ME))} style={{ left: me.x, top: me.y, width: me.r * 2, height: me.r * 2 }}>
          <button
            type="button"
            aria-label={t.meAria(data.me.name, data.me.signName)}
            aria-pressed={selected === ME}
            onClick={() => setSelected((cur) => (cur === ME ? null : ME))}
            className="group/me block size-full rounded-full motion-safe:animate-breathe"
          >
            <span
              className={cn(
                `block size-full overflow-hidden rounded-full border-4 border-fg bg-surface transition-[scale] duration-500 ${SPRING} group-hover/me:scale-104`,
                drag?.target === ME && "scale-110",
              )}
              style={{
                boxShadow:
                  "0 0 0 12px color-mix(in oklab, var(--highlight) 14%, transparent), 0 0 0 28px color-mix(in oklab, var(--highlight) 6%, transparent), 0 18px 44px rgb(0 0 0 / 0.16)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URI */}
              <img src={data.me.avatarUri} alt="" draggable={false} className="size-full dark:invert" />
            </span>
          </button>
          <div className="pointer-events-none absolute top-full left-1/2 flex -translate-x-1/2 -translate-y-[18px] flex-col items-center gap-1">
            <h1 className="max-w-48 truncate rounded-full bg-fg px-4 py-1 font-heading text-xl leading-tight font-semibold text-bg lg:text-2xl">
              {data.me.name}
            </h1>
            <span className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-medium whitespace-nowrap tabular-nums">
              <span>{data.me.signName}</span>
              <span aria-hidden>·</span>
              <span>{data.me.birthDate}</span>
            </span>
          </div>
        </div>

        {/* Reading buttons */}
        {selBody &&
          selReadings.map((r, i) => {
            const a = angles[i];
            const rr = selBody.r + layout.ring.gap * Math.min(1, k);
            const x = selBody.x + Math.cos(a) * rr;
            const y = selBody.y + Math.sin(a) * rr;
            const product = data.products[r.code];
            const owner = sel === ME ? data.me.name : (selPerson?.name ?? "");
            // The name sits on the far side of the button, away from the planet, unless that
            // would run off screen; around me (centre of the screen) it goes above or below.
            const cos = Math.cos(a);
            const sin = Math.sin(a);
            const off = ringButton / 2 + 6;
            const vertical = sin < 0 ? "above" : "below";
            let side: "left" | "right" | "above" | "below" =
              sel === ME ? vertical : cos < -0.35 ? "left" : cos > 0.35 ? "right" : vertical;
            if (side === "left" && x - off - LABEL_W < 8) side = vertical;
            if (side === "right" && x + off + LABEL_W > w - 8) side = vertical;
            const labelAt = {
              left: { dx: -off, dy: 0, cls: "-translate-x-full -translate-y-1/2 text-right" },
              right: { dx: off, dy: 0, cls: "-translate-y-1/2 text-left" },
              above: { dx: 0, dy: -off, cls: "-translate-x-1/2 -translate-y-full text-center" },
              below: { dx: 0, dy: off, cls: "-translate-x-1/2 text-center" },
            }[side];
            return (
              <Link
                key={`${sel}-${r.code}`}
                href={readingHref(sel!, r)}
                scroll={false}
                aria-label={t.reading(product?.name ?? r.code, owner, !!r.purchaseId)}
                className="group/r absolute z-30 -translate-1/2 animate-pop-in"
                style={{ left: x, top: y, width: ringButton, height: ringButton, animationDelay: `${i * 0.05}s` }}
              >
                <span
                  className={cn(
                    `flex size-full items-center justify-center rounded-full border-2 shadow-[0_8px_20px_rgb(0_0_0/0.16)] transition-[scale] duration-300 ${SPRING} group-hover/r:scale-112`,
                    r.purchaseId ? "border-highlight bg-highlight text-highlight-fg" : "border-highlight/30 bg-surface text-highlight",
                  )}
                >
                  <ProductGlyph icon={product?.icon} className="size-[44%]" />
                </span>
                <span
                  className={cn(
                    "pointer-events-none absolute w-max max-w-24 rounded-xl bg-surface px-2 py-0.5 text-[11px] leading-tight font-semibold shadow-[0_2px_8px_rgb(0_0_0/0.08)]",
                    labelAt.cls,
                  )}
                  style={{ left: `calc(50% + ${labelAt.dx}px)`, top: `calc(50% + ${labelAt.dy}px)` }}
                >
                  {product?.name.replace(/ зурхай$/u, "") ?? r.code}
                </span>
              </Link>
            );
          })}

        <p
          aria-live="polite"
          className={cn(
            "pointer-events-none absolute bottom-[max(env(safe-area-inset-bottom),1rem)] left-1/2 z-5 max-w-[calc(100%-2rem)] -translate-x-1/2 truncate rounded-full bg-surface/70 px-4 py-2 text-center text-[13px] text-muted-foreground transition-opacity lg:bottom-8",
            showDock ? "opacity-0" : "opacity-100",
          )}
        >
          {drag?.moved
            ? drag.target
              ? t.dropOn(nameOf(drag.target))
              : t.dropAway
            : data.people.length === 0
              ? t.empty
              : t.hint}
        </p>
      </>
    );
  }
}
