"use client";

import {
  Calendar1,
  ChevronLeft,
  ChevronRight,
  LifeBuoy,
  Link2,
  Lock,
  Menu,
  Orbit,
  Plus,
  Sparkles,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { BottomSheet } from "@/components/app/bottom-sheet";
import { markOnboardingAction } from "@/app/actions/onboarding";
import { Burst, DragHint, GhostPlanet, GuidePill, GuideTip, GuideToast, WelcomeCard } from "@/components/home/guide";
import { ReadingTray, type TrayTile } from "@/components/home/reading-tray";
import { BrandMark } from "@/components/app/brand-mark";
import { NAV_ITEMS } from "@/components/app/nav-items";
import { SignOutButton } from "@/components/app/sign-out-button";
import { ThemeSwitch } from "@/components/app/theme-toggle";
import { WalletChip } from "@/components/app/wallet-chip";
import { PRODUCT_ICON_COMPONENTS, PRODUCT_TINT_CLASSES } from "@/components/readings/product-icon";
import { mn } from "@/i18n/mn";
import { BIRTHDAY_PRODUCT } from "@/lib/catalog-refs";
import { HOME_VIEW_COOKIE, type HomeView } from "@/lib/daily";
import { isOffOrbit, type ProductIconName, type ProductTint } from "@/lib/domain";
import { guideState, type GuideStep, type OnboardingMark, type OnboardingProgress } from "@/lib/onboarding";
import { relationTint } from "@/lib/people";
import type { Theme } from "@/lib/theme";
import {
  arrangeLinks,
  bodyPx,
  bringIn,
  captionBodies,
  chainPoint,
  clampToStage,
  dropTarget,
  initialSeating,
  layoutScale,
  pairKey,
  pickLayout,
  rimLine,
  scatter,
  todayCompact,
  todayLayout,
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
const FACE = "dark:bg-face";
/**
 * A bought pair's colours, also set inline (with fallbacks) so they show even if a cached
 * stylesheet predates the `--pair` tokens.
 */
const PAIR = "var(--pair, #dc5815)";
const PAIR_FG = "var(--pair-fg, #100f26)";
/** Room per person in the "+N" dock (its name fits under it); more people go to further pages. */
const DOCK_MIN_STEP = 76;
/** How long the opening fly-out lasts (ms). */
const INTRO_MS = 1600;
/** Switching between "today" and the planets: me grows/shrinks, the planets fold in/out. */
const SWAP_EASE = "ease-[cubic-bezier(.65,0,.35,1)]";

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
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}

/**
 * The signed-in home: "me" in the middle of the whole screen and my people as planets around,
 * scattered at random the first time and then wherever the user drags them. Tap a planet for its
 * readings and its links; drag it onto another to open their pair reading; drop it on empty
 * space to move it. Details open as popups (intercepted routes). Beyond six planets, and for
 * everyone marked "Хэн ч биш", people wait in a "+N" dock.
 *
 * Home has a second view, "today": me big with my sign's daily horoscopes beside it. Switching
 * moves the same "me" — it shrinks into the middle while the planets fly out of it, or grows
 * back while they fold into it — and the last view is remembered (cookie `home_view`).
 */
export function PlanetSystem({
  data,
  balance,
  appName,
  initialView = "planets",
  theme,
}: {
  data: PlanetSystemData;
  balance: number;
  appName: string;
  initialView?: HomeView;
  /** The colour mode in use: the menu shows the choice. */
  theme: Theme;
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
  const [view, setView] = useState<HomeView>(initialView);
  const today = view === "today";
  // Phone "today": once "me" has settled at the top, it follows the cards' scroll (it shrinks
  // into the top bar as they slide up over it — see `todayCompact`). The scroll writes `--tp`
  // (0 → 1) on the stage, so nothing re-renders while a finger is moving.
  const todayPanel = useRef<HTMLElement>(null);
  const [todayLive, setTodayLive] = useState(false);
  useEffect(() => {
    if (!today) return;
    const timer = setTimeout(() => setTodayLive(true), 1000);
    return () => clearTimeout(timer);
  }, [today]);
  // The opening fly-out belongs to the planets; opening on "today" has nothing to fly.
  const [intro, setIntro] = useState(initialView === "planets");
  const [selected, setSelected] = useState<string | null>(null);
  const [dockOpen, setDockOpen] = useState(false);
  /** The "+N" dock shows one page of people at a time; swipe (or the arrows/dots) for more. */
  const [dockPage, setDockPage] = useState({ index: 0, dir: 1 });
  const dockSwipe = useRef<number | null>(null);
  const [drag, setDragState] = useState<Drag | null>(null);
  // Pointer events can arrive before React re-renders (a quick tap), so handlers read the ref.
  const dragRef = useRef<Drag | null>(null);
  const setDrag = (d: Drag | null) => {
    dragRef.current = d;
    setDragState(d);
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const [foldedFor, setFoldedFor] = useState<string | null>(null);
  // First-run guide (src/lib/onboarding.ts): progress lives on the user; marked optimistically.
  const pathname = usePathname();
  const [progress, setProgress] = useState<OnboardingProgress>(data.onboarding);
  const [pillOpen, setPillOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [readyFlash, setReadyFlash] = useState(false);
  const mark = (m: OnboardingMark) => {
    if (progress[m]) return;
    setProgress((p) => (p[m] ? p : { ...p, [m]: new Date().toISOString() }));
    void markOnboardingAction(m);
  };

  const switchView = (next: HomeView) => {
    setSelected(null);
    setDockOpen(false);
    setDrag(null);
    setView(next);
    // "Me" travels between the views by its own transition, from wherever the scroll left it.
    setTodayLive(false);
    rootRef.current?.style.setProperty("--tp", "0");
    if (todayPanel.current) todayPanel.current.scrollTop = 0;
    try {
      document.cookie = `${HOME_VIEW_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    } catch {
      // Cookies blocked: home just opens on the default view next time.
    }
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

  // Someone added (also outside the guide): record it, so the step stays done.
  const hasPeople = data.people.length > 0;
  const addMarked = !!data.onboarding.add;
  useEffect(() => {
    if (hasPeople && !addMarked) void markOnboardingAction("add");
  }, [hasPeople, addMarked]);

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

  const guide = guideState(progress, {
    people: data.people.length,
    pairs: Object.keys(data.mePairs).length + links.length,
  });
  // A short cheer each time a step gets done — once back on home (popups closed).
  const doneKey = (["self", "add", "link"] as GuideStep[]).filter((st) => guide.done[st]).join(",");
  const cheered = useRef(doneKey);
  const firstName = data.people[0]?.name ?? "";
  useEffect(() => {
    if (pathname !== "/home" || progress.dismissed) return;
    const before = new Set(cheered.current.split(",").filter(Boolean));
    const now = doneKey.split(",").filter(Boolean) as GuideStep[];
    const fresh = now.filter((st) => !before.has(st));
    if (fresh.length === 0) {
      cheered.current = doneKey;
      return;
    }
    const step = fresh[fresh.length - 1];
    const label = step === "add" ? t.guide.done.add(firstName) : t.guide.done[step];
    // Marked as cheered only when shown, so a re-run of this effect (dev Strict Mode) still shows it.
    const show = window.setTimeout(() => {
      // Still on home? (A drag or a reading may be on its way to a popup — cheer on return.)
      if (window.location.pathname !== "/home") return;
      cheered.current = doneKey;
      setToast(`${label} · ${now.length}/3`);
      if (step === "link") setCelebrate(true);
      if (now.length === 3) setReadyFlash(true);
    }, 700);
    const hide = window.setTimeout(() => {
      setToast(null);
      setCelebrate(false);
    }, 3600);
    const unflash = window.setTimeout(() => setReadyFlash(false), 6000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
      window.clearTimeout(unflash);
    };
  }, [doneKey, pathname, progress.dismissed, firstName]);
  const pairHref = (a: string, b: string, purchaseId: string | null) => {
    if (purchaseId) return `/r/${purchaseId}`;
    if (!data.pairProduct) return null;
    const pa = a === ME ? data.me.id : a;
    const pb = b === ME ? data.me.id : b;
    return `/buy/${data.pairProduct}?a=${pa}&b=${pb}&from=h`;
  };
  const readingHref = (personId: string, r: PlanetReading) =>
    r.purchaseId ? `/r/${r.purchaseId}` : `/buy/${r.code}?a=${personId === ME ? data.me.id : personId}&from=h`;

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
      data-screen="home"
      data-view={view}
      className="fixed inset-0 h-dvh touch-none overflow-hidden bg-tint-1 select-none"
      aria-label={today ? mn.home.today.label : t.label}
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
          <Menu className="size-6" aria-hidden />
        </button>
        <span className="hidden items-center gap-2 font-heading text-3xl font-semibold lg:flex">
          <BrandMark className="size-5 text-highlight" />
          {appName}
        </span>
      </div>
      {/* Today ⇄ planets. Phone: a round button beside the menu; desktop: a pill under it. */}
      <button
        type="button"
        onClick={() => switchView(today ? "planets" : "today")}
        aria-label={today ? mn.home.view.toPlanetsAria : mn.home.view.toTodayAria}
        title={today ? mn.home.view.toPlanets : mn.home.view.toToday}
        className="absolute top-[max(env(safe-area-inset-top),1rem)] left-[76px] z-40 flex size-12 items-center justify-center gap-2 rounded-full bg-surface text-highlight shadow-[0_8px_20px_rgb(0_0_0/0.12)] transition-transform active:scale-95 lg:top-24 lg:left-8 lg:w-auto lg:pr-5 lg:pl-4"
      >
        {today ? <Orbit className="size-6" aria-hidden /> : <Calendar1 className="size-6" aria-hidden />}
        <span className="hidden text-sm font-semibold text-fg lg:inline">
          {today ? mn.home.view.toPlanets : mn.home.view.toToday}
        </span>
      </button>
      <div className="absolute top-[max(env(safe-area-inset-top),1rem)] right-4 z-40 lg:top-8 lg:right-8">
        <WalletChip balance={balance} />
      </div>

      {/* First-run guide: progress, welcome, cheers */}
      {size && loaded && !intro && !today && ((guide.active && !guide.welcome) || readyFlash) && (
        <GuidePill
          done={guide.done}
          current={guide.current}
          ready={!guide.current}
          open={pillOpen}
          onToggle={() => setPillOpen((o) => !o)}
        />
      )}
      {size && loaded && !intro && !today && guide.welcome && (
        <WelcomeCard name={data.me.name} onStart={() => mark("welcome")} onLater={() => mark("welcome")} />
      )}
      {toast && <GuideToast text={toast} />}

      <BottomSheet title={t.menu} open={menuOpen} onOpenChange={setMenuOpen}>
        <nav aria-label="Үндсэн цэс" className="flex flex-col gap-2">
          {[
            ...NAV_ITEMS.filter((n) => n.href !== "/home"),
            { href: "/wallet", label: mn.header.wallet, Icon: Wallet },
            { href: "/help", label: mn.help.title, Icon: LifeBuoy },
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
        </nav>
        <div className="flex flex-col gap-2 pt-5">
          <span className="text-sm font-semibold text-muted-foreground">{mn.me.appearance}</span>
          <ThemeSwitch current={theme} />
          <p className="text-xs text-muted-foreground">{mn.me.appearanceHint}</p>
        </div>
        <div className="pt-5">
          <SignOutButton />
        </div>
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
    // "Today": me big beside my daily horoscopes; everything else folds into me.
    const tl = todayLayout(w, h);
    const meNow = today ? tl.me : me;
    const tc = today ? todayCompact(w, h) : null;
    /** Following the cards' scroll (see `todayLive`): sizes are `calc()`s of `--tp`, untransitioned. */
    const live = tc !== null && todayLive;
    /** `from` at rest, `to` once the cards have scrolled all the way up over "me". */
    const shrink = (from: number, to: number, unit: "px" | "" = "px") =>
      live ? `calc(${from}${unit} - var(--tp, 0) * ${from - to}${unit})` : unit ? from : String(from);
    const meTop = shrink(meNow.y, tc?.me.y ?? meNow.y);
    const meSize = (k: number) => shrink(meNow.r * k, (tc?.me.r ?? meNow.r) * k);
    // To "today": the planets fold in first. To the planets: me goes first, they follow.
    const meDelay = today ? "250ms" : "100ms";

    // The "+N" dock: hidden people near the bottom, one page at a time — as many as fit with
    // their names readable; the rest are a swipe (or an arrow, or a dot) away.
    const dockY = (layout.dock.y / 100) * h;
    const dockW = Math.min(w - 32, layout.key === "phone" ? 420 : 640);
    const arrows = layout.key !== "phone";
    const step = Math.max(DOCK_MIN_STEP, layout.dock.step * Math.min(1, k));
    const perPage = Math.max(1, Math.floor((dockW - (arrows ? 112 : 24)) / step));
    const dockPages = Math.max(1, Math.ceil(hidden.length / perPage));
    const page = Math.min(dockPage.index, dockPages - 1);
    const docked = showDock ? hidden.slice(page * perPage, (page + 1) * perPage) : [];
    const dockR = Math.min(layout.dock.r * k, step / 2 - 10);
    const dockX0 = w / 2 - (docked.length * step) / 2 + step / 2;
    const turnPage = (dir: 1 | -1) => {
      const index = Math.min(dockPages - 1, Math.max(0, page + dir));
      if (index !== page) setDockPage({ index, dir });
    };

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
      // A sideways flick along the dock turns its page; it doesn't pull the person out.
      const dx = d.x + d.ox - d.sx;
      const dy = d.y + d.oy - d.sy;
      if (d.fromDock && Math.abs(dx) > 40 && Math.abs(dy) < 36) return turnPage(dx < 0 ? 1 : -1);
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
      mark("link");
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
          inert={today}
          className={cn(
            "absolute -translate-1/2",
            isDrag ? "z-30" : cn(`transition-[left,top,opacity] duration-500 ${SPRING}`, fromDock ? "z-20" : cn("z-10", dim(p.id))),
          )}
          style={{ left: b.x, top: b.y, width: b.r * 2, height: b.r * 2 }}
        >
          {/* Folded into me on "today": they fly back out (one after another) on the way to the planets. */}
          <div
            className={cn(
              `size-full transition-[translate,scale,opacity] ${SWAP_EASE} motion-reduce:transition-none`,
              today ? "duration-500" : "duration-700",
            )}
            style={
              today && !fromDock
                ? { translate: `${me.x - b.x}px ${me.y - b.y}px`, scale: "0.2", opacity: 0, transitionDelay: `${index * 40}ms` }
                : { transitionDelay: `${420 + index * 70}ms` }
            }
          >
          <div
            className={cn(
              "size-full",
              // A new dock page slides in from the side it was turned to.
              fromDock ? (dockPage.dir > 0 ? "animate-dock-next" : "animate-dock-prev") : intro && "motion-safe:animate-fly-in",
            )}
            style={fromDock ? { animationDelay: `${index * 0.03}s` } : fly}
          >
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
                <span
                  className="pointer-events-none absolute top-full left-1/2 mt-1.5 flex w-28 -translate-x-1/2 flex-col items-center"
                  style={fromDock ? { width: step - 8 } : undefined}
                >
                  <span className="max-w-full truncate text-sm leading-tight font-semibold lg:text-base">{p.name}</span>
                  {!fromDock && (
                    <span className="max-w-full truncate text-xs leading-tight text-muted-foreground">{p.signName}</span>
                  )}
                </span>
              </button>
            </div>
          </div>
          </div>
        </div>
      );
    };

    // The tapped planet's readings: a tray at the bottom (see reading-tray.tsx).
    const selPerson = sel === ME ? null : sel ? byId.get(sel) : null;
    const selReadings = sel === ME ? data.me.readings : (selPerson?.readings ?? []);
    const selBody = sel ? home.get(sel)! : null;

    // First-run guide: one tip at a time, on the next thing to do; out of the way while
    // dragging or while a sheet or the dock is open.
    const guideOn =
      guide.active && !guide.welcome && !intro && !today && !drag?.moved && !menuOpen && !foldedFor && !showDock;
    const birthday = data.me.readings.find((r) => r.code === BIRTHDAY_PRODUCT) ?? data.me.readings[0];
    const guideSelf = guideOn && guide.current === "self";
    const guideAdd = guideOn && guide.current === "add" && data.people.length === 0;
    const guideLinkId =
      guideOn && guide.current === "link" ? seating.seats.find((id) => home.has(id)) : undefined;
    const guideLinkPerson = guideLinkId ? byId.get(guideLinkId) : undefined;
    const GHOST_AT = layout.key === "phone"
      ? [{ x: 24, y: 30 }, { x: 78, y: 27 }, { x: 76, y: 70 }]
      : [{ x: 32, y: 30 }, { x: 70, y: 25 }, { x: 68, y: 74 }];
    const ghosts = guideAdd
      ? t.guide.ghosts.map((gh, i) => ({ ...gh, body: { ...toPx(GHOST_AT[i], w, h), r: layout.sizes[i] * k } }))
      : [];

    return (
      <>
        {/*
          Orbits around me; on "today" they hug the big me as halos. They move with me (same
          timing). The spinning dashed one never changes size — a running spin keeps its old
          pivot when its box resizes (it would wobble off-centre) — so its wrapper scales instead.
        */}
        <span
          aria-hidden
          className={cn(
            `pointer-events-none absolute -translate-1/2 transition-[left,top,scale] duration-700 ${SWAP_EASE} motion-reduce:transition-none`,
            live && "transition-none!",
          )}
          style={{
            left: meNow.x,
            top: meTop,
            width: me.r * 4.6,
            height: me.r * 4.6,
            scale: today
              ? shrink((meNow.r * 2.5) / (me.r * 4.6), ((tc?.me.r ?? meNow.r) * 2.5) / (me.r * 4.6), "")
              : "1",
            transitionDelay: meDelay,
          }}
        >
          <span
            key={Math.round(me.r * 4.6)}
            className="absolute inset-0 rounded-full border-[1.5px] border-dashed border-highlight/25 motion-safe:animate-orbit-spin"
          />
        </span>
        <span
          aria-hidden
          className={cn(
            `pointer-events-none absolute -translate-1/2 rounded-full border border-highlight/15 transition-[left,top,width,height] duration-700 ${SWAP_EASE} motion-reduce:transition-none`,
            live && "transition-none!",
          )}
          style={{ left: meNow.x, top: meTop, width: meSize(today ? 3.2 : 7.8), height: meSize(today ? 3.2 : 7.8), transitionDelay: meDelay }}
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
              style={{
                left: l.x,
                top: l.y - 1,
                width: l.length,
                transform: `rotate(${l.angle}deg)`,
                ...(e.on && e.key !== "ghost"
                  ? { height: 2.5, background: `repeating-linear-gradient(90deg, ${PAIR} 0 5px, transparent 5px 10px)` }
                  : null),
              }}
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
          const style = {
            left: p.x,
            top: p.y,
            width: chainSize,
            height: chainSize,
            ...(e.on ? { backgroundColor: PAIR, borderColor: PAIR, color: PAIR_FG } : null),
          };
          const body = (
            <>
              {e.on ? (
                <Link2 className="size-[38%] lg:size-[52%]" strokeWidth={2.5} aria-hidden />
              ) : (
                <Lock className="size-[44%]" aria-hidden />
              )}
              {e.count !== undefined && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-fg px-1 text-xs font-bold text-bg">
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
            inert={today}
            className={cn(
              "absolute z-20 -translate-1/2 transition-[opacity,scale] duration-300",
              today ? "scale-50 opacity-0" : selected && !showDock ? "opacity-30" : "opacity-100",
            )}
            style={{ left: more.x, top: more.y, width: more.r * 2, height: more.r * 2, transitionDelay: today ? "0ms" : "700ms" }}
          >
            <div className="size-full motion-safe:animate-drift-a" style={{ animationDelay: "-4s" }}>
              <button
                type="button"
                aria-label={showDock ? t.closeDock : t.moreAria(hidden.length)}
                aria-expanded={showDock}
                onClick={() => {
                  setSelected(null);
                  setDockPage({ index: 0, dir: 1 });
                  setDockOpen((o) => !o);
                }}
                className={cn(
                  `relative flex size-full items-center justify-center rounded-full border-[3px] border-surface font-heading text-xl font-semibold text-bg shadow-[0_8px_24px_rgb(0_0_0/0.18)] transition-[scale] duration-500 ${SPRING} hover:scale-110 lg:text-2xl`,
                  showDock ? "bg-highlight" : "bg-fg",
                )}
              >
                {showDock ? <X className="size-6" aria-hidden /> : `+${hidden.length}`}
                <span className="absolute top-full left-1/2 mt-1.5 -translate-x-1/2 font-sans text-sm font-semibold whitespace-nowrap text-highlight">
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
              className="absolute z-[15] -translate-x-1/2 animate-rise-in touch-pan-y rounded-4xl bg-surface/85 shadow-[0_-10px_40px_rgb(0_0_0/0.14)] backdrop-blur-md"
              style={{ left: w / 2, top: dockY - dockR - 40, width: dockW, height: dockR * 2 + (dockPages > 1 ? 96 : 76) }}
              onPointerDown={(e) => (dockSwipe.current = e.clientX)}
              onPointerUp={(e) => {
                const from = dockSwipe.current;
                dockSwipe.current = null;
                if (from !== null && Math.abs(e.clientX - from) > 40) turnPage(e.clientX < from ? 1 : -1);
              }}
            >
              <div className="absolute inset-x-5 top-3 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-semibold text-highlight">{t.dockTitle(hidden.length)}</p>
                <Link href="/people" scroll={false} className="shrink-0 text-xs font-semibold text-fg underline-offset-2 hover:underline">
                  {mn.home.all} →
                </Link>
              </div>
              {arrows && dockPages > 1 && (
                <>
                  <button
                    type="button"
                    aria-label={t.dockPrev}
                    disabled={page === 0}
                    onClick={() => turnPage(-1)}
                    className="absolute top-1/2 left-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-subtle disabled:opacity-30"
                  >
                    <ChevronLeft className="size-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={t.dockNext}
                    disabled={page === dockPages - 1}
                    onClick={() => turnPage(1)}
                    className="absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-subtle disabled:opacity-30"
                  >
                    <ChevronRight className="size-5" aria-hidden />
                  </button>
                </>
              )}
              {dockPages > 1 && (
                <div className="absolute inset-x-0 bottom-2 flex justify-center">
                  {Array.from({ length: dockPages }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={t.dockPage(i + 1, dockPages)}
                      aria-current={i === page}
                      onClick={() => setDockPage({ index: i, dir: i > page ? 1 : -1 })}
                      className="flex size-6 items-center justify-center"
                    >
                      <span className={cn("size-1.5 rounded-full transition-colors", i === page ? "bg-fg" : "bg-border")} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            {docked.map((p, i) => planet(p, true, i))}
          </>
        )}

        <div
          inert={today}
          className={cn(
            "absolute z-10 -translate-1/2 transition-[opacity,scale] duration-300",
            today ? "scale-50 opacity-0" : selected || showDock ? "opacity-30" : "opacity-100",
          )}
          style={(() => {
            const a = bodyPx(layout.add, w, h, k);
            return { left: a.x, top: a.y, width: a.r * 2, height: a.r * 2, transitionDelay: today ? "0ms" : "750ms" } as CSSProperties;
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
            <span className="pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 text-sm font-semibold whitespace-nowrap text-highlight">
              {mn.people.add}
            </span>
          </div>
        </div>

        {/* Me */}
        <div
          className={cn(
            `absolute z-[16] -translate-1/2 transition-[left,top,width,height,opacity] duration-700 ${SWAP_EASE} motion-reduce:transition-none`,
            live && "transition-none!",
            dim(ME),
          )}
          style={{
            left: meNow.x,
            top: meTop,
            width: meSize(2),
            height: meSize(2),
            transitionDelay: meDelay,
          }}
        >
          <button
            type="button"
            inert={today}
            aria-label={t.meAria(data.me.name, data.me.signName)}
            aria-pressed={selected === ME}
            onClick={() => setSelected((cur) => (cur === ME ? null : ME))}
            className="group/me relative block size-full rounded-full motion-safe:animate-breathe"
          >
            {guideSelf && selected !== ME && (
              <span aria-hidden className="absolute inset-0 rounded-full motion-safe:animate-guide-halo" />
            )}
            <span
              className={cn(
                `block size-full overflow-hidden rounded-full border-4 border-fg bg-surface transition-[scale] duration-500 ${SPRING} group-hover/me:scale-104 dark:border-highlight dark:bg-face`,
                drag?.target === ME && "scale-110",
              )}
              style={{
                // Tapped (its tray open): ringed like a tapped planet.
                boxShadow:
                  selected === ME
                    ? "0 0 0 6px var(--bg), 0 0 0 10px var(--highlight), 0 0 0 30px color-mix(in oklab, var(--highlight) 10%, transparent), 0 18px 44px rgb(0 0 0 / 0.16)"
                    : "0 0 0 12px color-mix(in oklab, var(--highlight) 14%, transparent), 0 0 0 28px color-mix(in oklab, var(--highlight) 6%, transparent), 0 18px 44px rgb(0 0 0 / 0.16)",
                transition: "box-shadow .3s",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URI */}
              <img src={data.me.avatarUri} alt="" draggable={false} className="size-full" />
            </span>
          </button>
          <div
            className={cn(
              `pointer-events-none absolute top-full left-1/2 flex origin-top -translate-x-1/2 -translate-y-[18px] flex-col items-center gap-1 transition-[scale] duration-700 ${SWAP_EASE}`,
              today ? "scale-115 lg:scale-135" : "scale-100",
            )}
            style={{ transitionDelay: meDelay, opacity: live ? "calc(1 - var(--tp, 0) * 3)" : undefined }}
          >
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

        {/* The tapped planet's readings, in a tray at the bottom */}
        {selBody && !today && (
          <ReadingTray
            key={sel}
            name={sel === ME ? data.me.name : (selPerson?.name ?? "")}
            sub={
              sel === ME
                ? t.traySelf(data.me.signName, data.me.birthDate)
                : selPerson
                  ? `${selPerson.relationText} · ${selPerson.signName}`
                  : ""
            }
            avatarUri={sel === ME ? data.me.avatarUri : (selPerson?.avatarUri ?? "")}
            faceClass={cn(FACE, sel === ME ? "border-fg bg-surface" : ["border-surface", selPerson && relationTint(selPerson.relation)])}
            onClose={() => setSelected(null)}
            tiles={[
              ...selReadings.map((r): TrayTile => {
                const product = data.products[r.code];
                const owner = sel === ME ? data.me.name : (selPerson?.name ?? "");
                return {
                  key: r.code,
                  href: readingHref(sel!, r),
                  label: t.short[r.code] ?? product?.name.replace(/ зурхай$/u, "") ?? r.code,
                  aria: t.reading(product?.name ?? r.code, owner, !!r.purchaseId),
                  icon: <ProductGlyph icon={product?.icon} className="size-5" />,
                  kind: r.purchaseId ? "on" : "off",
                  onClick:
                    sel === ME
                      ? () => {
                          mark("self");
                          // Back on home the next step takes over, so close my readings.
                          setSelected(null);
                        }
                      : undefined,
                  tip: guideSelf && sel === ME && r === birthday ? t.guide.tips.reading : undefined,
                };
              }),
              {
                key: "info",
                href: `/people/${sel === ME ? data.me.id : sel}`,
                label: t.info,
                aria: t.infoAria(sel === ME ? data.me.name : (selPerson?.name ?? "")),
                icon: <UserRound className="size-5" strokeWidth={1.75} aria-hidden />,
                kind: "info",
              },
            ]}
          />
        )}

        {/* First-run guide */}
        {ghosts.map((gh, i) => (
          <GhostPlanet key={gh.relation} body={gh.body} label={gh.label} relation={gh.relation} index={i} />
        ))}
        {guideAdd && ghosts[0] && (
          <GuideTip
            x={ghosts[0].body.x}
            top={ghosts[0].body.y - ghosts[0].body.r}
            bottom={ghosts[0].body.y + ghosts[0].body.r + 26}
            w={w}
            title={t.guide.tips.add.title}
            sub={t.guide.tips.add.sub}
          />
        )}
        {guideSelf && selected !== ME && (
          <GuideTip
            x={me.x}
            top={me.y - me.r - 16}
            bottom={me.y + me.r + 50}
            w={w}
            title={t.guide.tips.me.title}
            sub={t.guide.tips.me.sub}
          />
        )}
        {guideLinkId && guideLinkPerson && (
          <>
            <DragHint
              from={home.get(guideLinkId)!}
              to={me}
              avatarUri={guideLinkPerson.avatarUri}
              tint={relationTint(guideLinkPerson.relation)}
            />
            <GuideTip
              x={home.get(guideLinkId)!.x}
              top={home.get(guideLinkId)!.y - home.get(guideLinkId)!.r - 4}
              bottom={home.get(guideLinkId)!.y + home.get(guideLinkId)!.r + 34}
              w={w}
              title={t.guide.tips.link.title}
              sub={t.guide.tips.link.sub}
            />
          </>
        )}
        {celebrate && <Burst x={me.x} y={me.y - me.r * 0.6} />}
        {guideOn && !toast && !selBody && (
          <button
            type="button"
            onClick={() => mark("dismissed")}
            className="absolute bottom-[max(env(safe-area-inset-bottom),1rem)] left-1/2 z-[39] flex h-10 -translate-x-1/2 animate-pop-in items-center rounded-full bg-surface/80 px-4 text-sm font-semibold text-muted-foreground shadow-[0_4px_14px_rgb(0_0_0/0.08)] backdrop-blur lg:bottom-8"
          >
            {t.guide.later}
          </button>
        )}

        {/* Today: my sign's daily horoscopes */}
        <section
          aria-label={mn.home.today.label}
          inert={!today}
          className={cn(
            "absolute z-20 flex touch-pan-y flex-col overflow-y-auto overscroll-contain transition-opacity duration-500 [scrollbar-width:none] max-lg:[mask-image:linear-gradient(to_bottom,transparent,black_14px)]",
            today ? "opacity-100 delay-[650ms]" : "pointer-events-none opacity-0 delay-0",
          )}
          ref={todayPanel}
          // Phone: the area reaches up to the top bar and its content starts under the big
          // "me" (the padding below), so the cards can slide up over it as it shrinks.
          onScroll={
            tc
              ? (e) =>
                  rootRef.current?.style.setProperty(
                    "--tp",
                    String(Math.min(1, e.currentTarget.scrollTop / tc.distance)),
                  )
              : undefined
          }
          style={{ left: tl.panel.left, top: tc ? tc.top : tl.panel.top, width: tl.panel.width, bottom: tl.panel.bottom }}
        >
          <div
            className="my-auto flex flex-col gap-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] lg:gap-4 lg:py-2"
            style={tc ? { paddingTop: tc.distance + 12 } : undefined}
          >
            <p className="px-1 text-center text-sm font-semibold text-highlight lg:text-left">
              {mn.home.today.eyebrow(data.today.label, data.me.signName)}
            </p>
            {data.today.readings.map((r, i) => (
              <article
                key={r.code}
                className={cn(
                  `rounded-3xl bg-surface p-5 shadow-[0_8px_24px_rgb(0_0_0/0.06)] transition-[opacity,translate] duration-500 ${SWAP_EASE} motion-reduce:transition-none lg:p-6`,
                  today ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
                )}
                style={{ transitionDelay: today ? `${650 + i * 90}ms` : "0ms" }}
              >
                <h2 className="flex items-center gap-3 font-heading text-xl leading-tight font-semibold lg:text-2xl">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      PRODUCT_TINT_CLASSES[r.tint as ProductTint] ?? PRODUCT_TINT_CLASSES["tint-1"],
                    )}
                  >
                    <ProductGlyph icon={r.icon} className="size-5" />
                  </span>
                  {r.name}
                </h2>
                {r.text ? (
                  <div className="mt-3 flex flex-col gap-2.5 text-base leading-relaxed">
                    {r.text.split(/\n\s*\n/).map((para, j) => (
                      <p key={j} className="whitespace-pre-line">
                        {para}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-base text-muted-foreground">{mn.home.today.empty}</p>
                )}
              </article>
            ))}
          </div>
        </section>

        <p
          aria-live="polite"
          className={cn(
            "pointer-events-none absolute bottom-[max(env(safe-area-inset-bottom),1rem)] left-1/2 z-5 max-w-[calc(100%-2rem)] -translate-x-1/2 truncate rounded-full bg-surface/70 px-4 py-2 text-center text-sm text-muted-foreground transition-opacity lg:bottom-8",
            today || (showDock && !drag?.moved) || guideOn || guide.welcome || toast || selBody ? "opacity-0" : "opacity-100",
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
