"use client";

import { Link2, Lock, Menu, Plus, Sparkles, UserRound, Wallet, X } from "lucide-react";
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
import { isOffOrbit, type ProductIconName } from "@/lib/domain";
import { relationTint } from "@/lib/people";
import {
  arrangeLinks,
  bodyPx,
  bringIn,
  captionBodies,
  chainPoint,
  clampToStage,
  dropTarget,
  fitRing,
  initialSeating,
  layoutScale,
  pairKey,
  pickLayout,
  rimLine,
  ringAngles,
  scatter,
  toPct,
  toPx,
  type Body,
  type LayoutKey,
  type PairLink,
  type Point,
  type Seating,
} from "@/lib/planet-system";
import { cn } from "@/lib/utils";
import type { PlanetPerson, PlanetReading, PlanetSystemData } from "@/server/planets";

const t = mn.home.planets;
const ME = "me";

const DRIFT = ["motion-safe:animate-drift-a", "motion-safe:animate-drift-b", "motion-safe:animate-drift-c"];
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
/** Planet faces: pastel by relation; light in dark mode so the line-art avatar reads. */
const FACE = "dark:bg-nav";
/** Smallest gap between planets in the "+N" dock before it shows a "see all" link instead. */
const DOCK_MIN_STEP = 60;
/** Widest a reading button's name gets (Tailwind max-w-28). */
const LABEL_W = 112;
/** How long the opening fly-out lasts (ms). */
const INTRO_MS = 1600;

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

type Places = Record<LayoutKey, Record<string, Point>>;
type Stored = { seating: Seating; links: PairLink[]; places: Places };

function load(key: string): Partial<Stored> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<Stored>) : null;
  } catch {
    return null;
  }
}

function ProductGlyph({ icon, className }: { icon: string | undefined; className?: string }) {
  const Icon = PRODUCT_ICON_COMPONENTS[icon as ProductIconName] ?? Sparkles;
  return <Icon className={className} strokeWidth={1.8} aria-hidden />;
}

/**
 * The signed-in home: "me" in the middle of the whole screen and my people as planets around,
 * scattered at random the first time and then wherever the user drags them. Tap a planet for its
 * readings and its links; drag it onto another to open their pair reading; drop it on empty
 * space to move it. Details open as popups (intercepted routes). Beyond six planets, and for
 * everyone marked "Хэн ч биш", people wait in a "+N" dock.
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
  const orbitIds = data.people.filter((p) => !isOffOrbit(p.relation)).map((p) => p.id);
  const offCount = data.people.length - orbitIds.length;
  const storeKey = `planets:v2:${data.me.id}`;
  const [seating, setSeating] = useState<Seating>(() => initialSeating(orbitIds, null, offCount));
  const [places, setPlaces] = useState<Places>({ phone: {}, desktop: {} });
  const [drawn, setDrawn] = useState<PairLink[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [intro, setIntro] = useState(true);
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

  // Seating, places and hand-drawn pairs live in this browser only.
  const orbitKey = orbitIds.join(",");
  const allKey = data.people.map((p) => p.id).join(",");
  useEffect(() => {
    const saved = load(storeKey);
    const orbit = orbitKey ? orbitKey.split(",") : [];
    const all = new Set(allKey ? allKey.split(",") : []);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring browser-only state after mount
    setSeating(initialSeating(orbit, saved?.seating, offCount));
    setDrawn((saved?.links ?? []).filter((l) => all.has(l.a) && all.has(l.b)));
    setPlaces(saved?.places ?? { phone: {}, desktop: {} });
    setLoaded(true);
  }, [storeKey, orbitKey, allKey, offCount]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        storeKey,
        JSON.stringify({ seating, links: drawn, places } satisfies Stored),
      );
    } catch {
      // Private mode or storage full: the planets just won't remember.
    }
  }, [loaded, storeKey, seating, drawn, places]);

  function radiusOf(rank: number, k: number) {
    const layout = pickLayout(size?.w ?? 0);
    return layout.sizes[Math.min(rank, layout.sizes.length - 1)] * k;
  }
  const rankOf = (id: string) => Math.max(0, orbitIds.indexOf(id));

  // Planets without a place yet are scattered at random spots.
  const layoutKey = size ? pickLayout(size.w).key : null;
  const seatsKey = seating.seats.join(",");
  useEffect(() => {
    if (!loaded || !size || !layoutKey) return;
    const layout = pickLayout(size.w);
    const k = layoutScale(layout, size.w, size.h);
    const mine = places[layoutKey];
    const missing = seating.seats.filter((id) => !mine[id]);
    if (missing.length === 0) return;
    const meBody = bodyPx(layout.me, size.w, size.h, k);
    const taken: Body[] = [
      meBody,
      ...captionBodies(meBody, 180),
      bodyPx(layout.more, size.w, size.h, k),
      bodyPx(layout.add, size.w, size.h, k),
      ...seating.seats
        .filter((id) => mine[id])
        .map((id) => ({ ...toPx(mine[id], size.w, size.h), r: radiusOf(rankOf(id), k) })),
    ];
    const placed = scatter(
      missing.map((id) => ({ id, r: radiusOf(rankOf(id), k) })),
      taken,
      size.w,
      size.h,
      layout,
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- places depend on the measured screen
    setPlaces((cur) => ({ ...cur, [layoutKey]: { ...cur[layoutKey], ...placed } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-scatter only when seats or screen change
  }, [loaded, layoutKey, seatsKey, size?.w, size?.h]);

  // The opening fly-out from the centre plays once per visit.
  useEffect(() => {
    if (!loaded || !size) return;
    const id = window.setTimeout(() => setIntro(false), INTRO_MS);
    return () => window.clearTimeout(id);
  }, [loaded, size]);

  const byId = new Map(data.people.map((p) => [p.id, p]));
  const nameOf = (id: string) => (id === ME ? data.me.name : (byId.get(id)?.name ?? ""));
  const offOrbit = (id: string) => {
    const p = byId.get(id);
    return !!p && isOffOrbit(p.relation);
  };
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

  /** Seats people (never "Хэн ч биш"); a newcomer takes over the place of whoever left. */
  const seat = (ids: string[], extra?: Partial<Record<LayoutKey, Record<string, Point>>>) => {
    const result = bringIn(
      seating,
      ids.filter((id) => id !== ME && !offOrbit(id)),
    );
    setSeating({ seats: result.seats, touch: result.touch, tick: result.tick });
    setPlaces((cur) => {
      const next: Places = { phone: { ...cur.phone }, desktop: { ...cur.desktop } };
      for (const [incoming, outgoing] of result.swaps) {
        for (const key of ["phone", "desktop"] as const) {
          if (next[key][outgoing]) next[key][incoming] = next[key][outgoing];
        }
      }
      for (const key of ["phone", "desktop"] as const) Object.assign(next[key], extra?.[key]);
      return next;
    });
  };

  return (
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
      {size && loaded && renderStage()}

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
          {[
            ...NAV_ITEMS.filter((n) => n.href !== "/home"),
            { href: "/wallet", label: mn.header.wallet, Icon: Wallet },
          ].map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="flex min-h-14 items-center gap-3 rounded-2xl bg-subtle px-4 text-base font-semibold"
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          ))}
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
                        seat([l.a, l.b]);
                      }}
                      className="flex min-h-16 items-center gap-3 rounded-2xl bg-subtle px-3 py-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- local data URI */}
                      <img
                        src={p.avatarUri}
                        alt=""
                        className={cn("size-10 rounded-full", relationTint(p.relation), FACE)}
                      />
                      <span className="flex flex-1 flex-col">
                        <span className="font-semibold">
                          {nameOf(foldedFor)} × {p.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {l.purchaseId ? t.bought : t.notBought}
                        </span>
                      </span>
                      {l.purchaseId ? (
                        <Link2 className="size-5 text-pair" aria-hidden />
                      ) : (
                        <Lock className="size-5 text-muted-foreground" aria-hidden />
                      )}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </BottomSheet>
      )}
    </div>
  );

  function renderStage() {
    const { w, h } = size!;
    const layout = pickLayout(w);
    const k = layoutScale(layout, w, h);
    const mine = places[layout.key];
    const me = bodyPx(layout.me, w, h, k);
    const more = hidden.length > 0 ? bodyPx(layout.more, w, h, k) : null;
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
    for (const id of seating.seats) {
      if (mine[id]) home.set(id, { ...toPx(mine[id], w, h), r: radiusOf(rankOf(id), k) });
    }
    docked.forEach((p, i) => home.set(p.id, { x: dockX0 + i * step, y: dockY, r: dockR }));
    const pos = (id: string): Body | undefined => {
      const b = home.get(id);
      if (drag?.moved && drag.id === id && b) return { x: drag.x, y: drag.y, r: b.r };
      return b;
    };
    const dim = (id: string) => (selected && selected !== id ? "opacity-30" : "opacity-100");
    const { drawn: drawnLinks, folded } = arrangeLinks(links, (id) => home.has(id));

    const onDown = (id: string, fromDock: boolean) => (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      const b = home.get(id);
      if (!b) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ id, fromDock, sx: e.clientX, sy: e.clientY, ox: e.clientX - b.x, oy: e.clientY - b.y, x: b.x, y: b.y, moved: false, target: null });
    };
    const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
      const d = dragRef.current;
      if (!d) return;
      const moved = d.moved || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6;
      const x = e.clientX - d.ox;
      const y = e.clientY - d.oy;
      const r = home.get(d.id)?.r ?? 30;
      const others = [...home.entries()].filter(([id]) => id !== d.id).map(([id, body]) => ({ id, body }));
      setDrag({ ...d, moved, x, y, target: moved ? dropTarget({ x, y, r }, others) : null });
    };
    const onUp = () => {
      const d = dragRef.current;
      if (!d) return;
      setDrag(null);
      if (!d.moved) return tap(d.id, d.fromDock);
      if (d.target) return connect(d.id, d.target);
      // Dropped on empty space: the planet stays there (a docked one joins the orbit there).
      if (d.fromDock && offOrbit(d.id)) return;
      const r = home.get(d.id)?.r ?? radiusOf(rankOf(d.id), k);
      const at = toPct(clampToStage({ x: d.x, y: d.y }, r, w, h, layout), w, h);
      seat([d.id], { [layout.key]: { [d.id]: at } });
      if (d.fromDock) setDockOpen(false);
    };
    const tap = (id: string, fromDock: boolean) => {
      if (fromDock && !offOrbit(id)) {
        seat([id]);
        setDockOpen(false);
        setSelected(id);
      } else {
        setSelected((cur) => (cur === id ? null : id));
      }
    };
    const connect = (a: string, b: string) => {
      let href: string | null;
      if (b === ME) href = pairHref(ME, a, data.mePairs[a] ?? null);
      else {
        const existing = links.find((l) => pairKey(l.a, l.b) === pairKey(a, b));
        if (!existing) setDrawn((cur) => [...cur, { a, b, purchaseId: null }]);
        href = pairHref(a, b, existing?.purchaseId ?? null);
      }
      seat([a, b]);
      setDockOpen(false);
      setSelected(null);
      if (href) router.push(href, { scroll: false });
    };

    // Lines and chains only for the tapped planet (or me) — the rest stay uncluttered.
    const sel = selected && home.has(selected) && !drag?.moved ? selected : null;
    type Edge = {
      key: string;
      a: Body;
      b: Body;
      on: boolean;
      label: string;
      href?: string | null;
      onClick?: () => void;
      count?: number;
      /** Where the chain sits along the line (0.5 = middle). */
      at?: number;
    };
    const edges: Edge[] = [];
    if (sel === ME) {
      for (const id of seating.seats) {
        const b = pos(id);
        const purchaseId = data.mePairs[id] ?? null;
        if (b) edges.push({ key: `me-${id}`, a: me, b, on: !!purchaseId, label: t.pair(data.me.name, nameOf(id), !!purchaseId), href: pairHref(ME, id, purchaseId) });
      }
    } else if (sel) {
      const b = pos(sel)!;
      const purchaseId = data.mePairs[sel] ?? null;
      edges.push({ key: `me-${sel}`, a: me, b, on: !!purchaseId, label: t.pair(data.me.name, nameOf(sel), !!purchaseId), href: pairHref(ME, sel, purchaseId) });
      for (const l of drawnLinks) {
        if (l.a !== sel && l.b !== sel) continue;
        const a = pos(l.a);
        const c = pos(l.b);
        if (a && c)
          edges.push({
            key: `l-${pairKey(l.a, l.b)}`,
            a,
            b: c,
            on: !!l.purchaseId,
            label: t.pair(nameOf(l.a), nameOf(l.b), !!l.purchaseId),
            onClick: () => {
              seat([l.a, l.b]);
              const href = pairHref(l.a, l.b, l.purchaseId);
              if (href) router.push(href, { scroll: false });
            },
          });
      }
      const f = folded.get(sel);
      if (f && more)
        edges.push({ key: `f-${sel}`, a: b, b: more, on: f.some((l) => l.purchaseId), label: t.folded(nameOf(sel), f.length), onClick: () => setFoldedFor(sel), count: f.length, at: 0.75 });
    }
    const ghost = drag?.moved && drag.target ? { a: pos(drag.id)!, b: home.get(drag.target)! } : null;

    const chainSize = layout.chain * k;
    const planet = (p: PlanetPerson, fromDock: boolean, index: number) => {
      const b = pos(p.id)!;
      const isDrag = drag?.moved && drag.id === p.id;
      const fly =
        intro && !fromDock
          ? ({ "--fly-x": `${me.x - b.x}px`, "--fly-y": `${me.y - b.y}px`, animationDelay: `${index * 0.08}s` } as CSSProperties)
          : undefined;
      return (
        <div
          key={p.id}
          className={cn(
            "absolute -translate-1/2",
            isDrag ? "z-30" : cn(`transition-[left,top,opacity] duration-500 ${SPRING}`, fromDock ? "z-20" : cn("z-10", dim(p.id))),
          )}
          style={{ left: b.x, top: b.y, width: b.r * 2, height: b.r * 2 }}
        >
          <div className={cn("size-full", fromDock ? "animate-rise-in" : intro && "motion-safe:animate-fly-in")} style={fly}>
            <div
              className={cn("size-full", !isDrag && !fromDock && DRIFT[index % DRIFT.length])}
              style={{ animationDelay: `${-index * 1.7}s` }}
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
                {index === 1 && !fromDock && (
                  <span
                    aria-hidden
                    className="absolute top-1/2 left-1/2 h-[42%] w-[150%] -translate-1/2 -rotate-[18deg] rounded-[50%] border-[1.5px] border-highlight/35"
                  />
                )}
                <span
                  className={cn(
                    `relative block size-full overflow-hidden rounded-full border-[3px] border-surface shadow-[0_8px_24px_rgb(0_0_0/0.14)] transition-[scale,box-shadow] duration-500 ${SPRING} group-hover/p:scale-108`,
                    relationTint(p.relation),
                    FACE,
                    drag?.target === p.id && "scale-115 shadow-[0_0_0_8px_color-mix(in_oklab,var(--highlight)_25%,transparent)]",
                    selected === p.id && "shadow-[0_0_0_5px_var(--bg),0_0_0_8px_var(--highlight)]",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local data URI */}
                  <img src={p.avatarUri} alt="" draggable={false} className="size-full" />
                </span>
                <span className="pointer-events-none absolute top-full left-1/2 mt-1.5 flex w-28 -translate-x-1/2 flex-col items-center">
                  <span className="max-w-full truncate text-[13px] leading-tight font-semibold lg:text-[15px]">{p.name}</span>
                  {!fromDock && (
                    <span className="max-w-full truncate text-[11px] leading-tight text-muted-foreground">{p.signName}</span>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      );
    };

    // Reading buttons around the selected planet (or me).
    const selPerson = sel === ME ? null : sel ? byId.get(sel) : null;
    const selReadings = sel === ME ? data.me.readings : (selPerson?.readings ?? []);
    const selBody = sel ? home.get(sel)! : null;
    const ringButton = layout.ring.button * Math.min(1, k);
    const ringR = selBody ? selBody.r + layout.ring.gap * Math.min(1, k) : 0;
    const ringEdge = ringButton / 2 + 8;
    const angles = selBody
      ? fitRing(selBody, ringR, ringAngles(selBody, center, selReadings.length + 1, sel === ME, layout.ring.step), {
          left: ringEdge,
          top: ringEdge + 64,
          right: w - ringEdge,
          bottom: h - ringEdge - 40,
        })
      : [];

    /**
     * A ring button's name: just outside the button, straight away from the planet, so
     * neighbours' names point different ways; kept on screen.
     */
    const ringLabel = (a: number, x: number, y: number, text: string) => {
      const labelW = Math.min(LABEL_W, text.length * 6.6 + 22);
      const labelH = 22;
      const reach = ringButton / 2 + 6;
      const cx = Math.min(w - 8 - labelW / 2, Math.max(8 + labelW / 2, x + Math.cos(a) * (reach + labelW / 2)));
      const cy = y + Math.sin(a) * (reach + labelH / 2);
      return (
        <span
          className="pointer-events-none absolute max-w-28 -translate-1/2 truncate rounded-full bg-surface px-2.5 py-1 text-xs leading-none font-semibold whitespace-nowrap shadow-[0_1px_4px_rgb(0_0_0/0.08)]"
          style={{ left: `calc(50% + ${cx - x}px)`, top: `calc(50% + ${cy - y}px)` }}
        >
          {text}
        </span>
      );
    };

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

        {/* Links of the tapped planet, rim to rim, with the chain in the middle. */}
        {[...edges, ...(ghost ? [{ key: "ghost", ...ghost, on: false }] : [])].map((e) => {
          const l = rimLine(e.a, e.b);
          return (
            <span
              key={`line-${e.key}`}
              aria-hidden
              className={cn(
                "pointer-events-none absolute planet-line",
                e.key === "ghost"
                  ? "planet-line-ghost motion-safe:animate-line-flow"
                  : e.on && "planet-line-on motion-safe:animate-line-flow",
              )}
              style={{ left: l.x, top: l.y - 1, width: l.length, transform: `rotate(${l.angle}deg)` }}
            />
          );
        })}
        {edges.map((e) => {
          const p = chainPoint(e.a, e.b, e.at);
          const cls = cn(
            "absolute z-10 flex -translate-1/2 animate-pop-in items-center justify-center rounded-full border-[1.5px] transition-[scale] duration-300 hover:scale-120",
            // Bought: filled with the pair colour, chain icon. Not yet: pale, padlock, still.
            e.on
              ? "scale-110 border-pair bg-pair text-pair-fg shadow-[0_0_0_4px_color-mix(in_oklab,var(--pair)_30%,transparent)] motion-safe:animate-ping-soft"
              : "border-muted-foreground/50 bg-surface text-muted-foreground",
          );
          const style = { left: p.x, top: p.y, width: chainSize, height: chainSize };
          const body = (
            <>
              {e.on ? (
                <Link2 className="size-[52%]" strokeWidth={2.4} aria-hidden />
              ) : (
                <Lock className="size-[44%]" strokeWidth={2} aria-hidden />
              )}
              {e.count !== undefined && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-fg px-1 text-[11px] font-bold text-bg">
                  {e.count}
                </span>
              )}
            </>
          );
          if (e.onClick)
            return (
              <button key={`chain-${e.key}`} type="button" aria-label={e.label} onClick={e.onClick} className={cls} style={style}>
                {body}
              </button>
            );
          return e.href ? (
            <Link key={`chain-${e.key}`} href={e.href} scroll={false} aria-label={e.label} className={cls} style={style}>
              {body}
            </Link>
          ) : null;
        })}

        {/* Planets */}
        {seating.seats.map((id, i) => {
          const p = byId.get(id);
          return p && home.has(id) && planet(p, false, i);
        })}

        {more && (
          <div
            className={cn("absolute z-20 -translate-1/2 transition-opacity duration-300", selected && !showDock ? "opacity-30" : "opacity-100")}
            style={{ left: more.x, top: more.y, width: more.r * 2, height: more.r * 2 }}
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
              style={{ left: w / 2, top: dockY - dockR - 40, width: Math.min(w - 32, Math.max(240, dockCount * step + 48)), height: dockR * 2 + 76 }}
            >
              <p className="absolute inset-x-6 top-3.5 truncate text-center text-xs font-semibold text-highlight">
                {t.dockTitle(hidden.length)}
              </p>
            </div>
            {docked.map((p, i) => planet(p, true, i))}
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
            const a = bodyPx(layout.add, w, h, k);
            return { left: a.x, top: a.y, width: a.r * 2, height: a.r * 2 } as CSSProperties;
          })()}
        >
          <div className="size-full motion-safe:animate-drift-b" style={{ animationDelay: "-6s" }}>
            <Link
              href="/people/new"
              scroll={false}
              aria-label={mn.people.add}
              className={`relative flex size-full items-center justify-center rounded-full border-2 border-dashed border-highlight text-highlight transition-[scale,rotate] duration-500 ${SPRING} hover:scale-110 hover:rotate-90`}
            >
              <Plus className="size-6" aria-hidden />
            </Link>
            <span className="pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 text-[13px] font-semibold whitespace-nowrap text-highlight">
              {mn.people.add}
            </span>
          </div>
        </div>

        {/* Me */}
        <div
          className={cn("absolute z-[16] -translate-1/2 transition-opacity duration-300", dim(ME))}
          style={{ left: me.x, top: me.y, width: me.r * 2, height: me.r * 2 }}
        >
          <button
            type="button"
            aria-label={t.meAria(data.me.name, data.me.signName)}
            aria-pressed={selected === ME}
            onClick={() => setSelected((cur) => (cur === ME ? null : ME))}
            className="group/me block size-full rounded-full motion-safe:animate-breathe"
          >
            <span
              className={cn(
                `block size-full overflow-hidden rounded-full border-4 border-fg bg-surface transition-[scale] duration-500 ${SPRING} group-hover/me:scale-104 dark:border-highlight dark:bg-nav`,
                drag?.target === ME && "scale-110",
              )}
              style={{
                boxShadow:
                  "0 0 0 12px color-mix(in oklab, var(--highlight) 14%, transparent), 0 0 0 28px color-mix(in oklab, var(--highlight) 6%, transparent), 0 18px 44px rgb(0 0 0 / 0.16)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URI */}
              <img src={data.me.avatarUri} alt="" draggable={false} className="size-full" />
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

        {/* Info button + reading buttons around the selected planet */}
        {selBody &&
          (() => {
            const a = angles[0];
            const x = Math.min(w - ringEdge, Math.max(ringEdge, selBody.x + Math.cos(a) * ringR));
            const y = Math.min(h - ringEdge - 40, Math.max(ringEdge + 64, selBody.y + Math.sin(a) * ringR));
            const owner = sel === ME ? data.me.name : (selPerson?.name ?? "");
            const id = sel === ME ? data.me.id : sel!;
            return (
              <Link
                key={`${sel}-info`}
                href={`/people/${id}`}
                scroll={false}
                aria-label={t.infoAria(owner)}
                className="group/r absolute z-30 -translate-1/2 animate-pop-in"
                style={{ left: x, top: y, width: ringButton, height: ringButton }}
              >
                <span
                  className={`flex size-full items-center justify-center rounded-full border-2 border-fg bg-fg text-bg shadow-[0_8px_20px_rgb(0_0_0/0.16)] transition-[scale] duration-300 ${SPRING} group-hover/r:scale-112`}
                >
                  <UserRound className="size-[44%]" strokeWidth={1.8} aria-hidden />
                </span>
                {ringLabel(a, x, y, t.info)}
              </Link>
            );
          })()}
        {selBody &&
          selReadings.map((r, i) => {
            const a = angles[i + 1];
            // The fan is already turned to fit; clamping only guards a screen too small for it.
            const x = Math.min(w - ringEdge, Math.max(ringEdge, selBody.x + Math.cos(a) * ringR));
            const y = Math.min(h - ringEdge - 40, Math.max(ringEdge + 64, selBody.y + Math.sin(a) * ringR));
            const product = data.products[r.code];
            const owner = sel === ME ? data.me.name : (selPerson?.name ?? "");
            const name = t.short[r.code] ?? product?.name.replace(/ зурхай$/u, "") ?? r.code;
            return (
              <Link
                key={`${sel}-${r.code}`}
                href={readingHref(sel!, r)}
                scroll={false}
                aria-label={t.reading(product?.name ?? r.code, owner, !!r.purchaseId)}
                className="group/r absolute z-30 -translate-1/2 animate-pop-in"
                style={{ left: x, top: y, width: ringButton, height: ringButton, animationDelay: `${(i + 1) * 0.05}s` }}
              >
                <span
                  className={cn(
                    `flex size-full items-center justify-center rounded-full border-2 shadow-[0_8px_20px_rgb(0_0_0/0.16)] transition-[scale] duration-300 ${SPRING} group-hover/r:scale-112`,
                    r.purchaseId ? "border-highlight bg-highlight text-highlight-fg" : "border-highlight/30 bg-surface text-highlight",
                  )}
                >
                  <ProductGlyph icon={product?.icon} className="size-[46%]" />
                </span>
                {ringLabel(a, x, y, name)}
              </Link>
            );
          })}

        <p
          aria-live="polite"
          className={cn(
            "pointer-events-none absolute bottom-[max(env(safe-area-inset-bottom),1rem)] left-1/2 z-5 max-w-[calc(100%-2rem)] -translate-x-1/2 truncate rounded-full bg-surface/70 px-4 py-2 text-center text-[13px] text-muted-foreground transition-opacity lg:bottom-8",
            showDock && !drag?.moved ? "opacity-0" : "opacity-100",
          )}
        >
          {drag?.moved
            ? drag.target
              ? t.dropOn(nameOf(drag.target))
              : drag.fromDock && offOrbit(drag.id)
                ? t.dropAway
                : t.dropMove
            : data.people.length === 0
              ? t.empty
              : t.hint}
        </p>
      </>
    );
  }
}
