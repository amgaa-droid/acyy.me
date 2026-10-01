/**
 * Home planet system: "me" in the middle of a full-screen stage, people as planets around.
 * Pure geometry and seating rules — the React component (src/components/home/planet-system.tsx)
 * only measures the screen and wires events.
 *
 * Positions are % of the stage, radii are px at the layout's reference size.
 */

export type Body = { x: number; y: number; r: number };
export type Point = { x: number; y: number };

export type PlanetLayout = {
  ref: { w: number; h: number };
  me: Body;
  /** Seats for people, closest first. The last one holds "+N" when people don't fit. */
  seats: Body[];
  add: Body;
  dock: { y: number; r: number; step: number };
  /** Reading buttons around a selected planet: distance from its edge, size, angle between. */
  ring: { gap: number; button: number; step: number };
  chain: number;
};

export const PHONE_LAYOUT: PlanetLayout = {
  ref: { w: 390, h: 844 },
  me: { x: 50, y: 49.8, r: 64 },
  seats: [
    { x: 23.6, y: 26.1, r: 38 },
    { x: 81, y: 55.7, r: 42 },
    { x: 76.9, y: 23.7, r: 32 },
    { x: 19.5, y: 66.4, r: 34 },
    { x: 56.9, y: 78.2, r: 30 },
    { x: 11.8, y: 46, r: 28 },
  ],
  add: { x: 86.2, y: 80.6, r: 28 },
  dock: { y: 90.3, r: 26, step: 68 },
  ring: { gap: 58, button: 46, step: 0.78 },
  chain: 30,
};

export const DESKTOP_LAYOUT: PlanetLayout = {
  ref: { w: 1440, h: 900 },
  me: { x: 50, y: 50, r: 104 },
  seats: [
    { x: 31.25, y: 26.7, r: 54 },
    { x: 81.25, y: 52.2, r: 60 },
    { x: 70.1, y: 22.2, r: 44 },
    { x: 29.2, y: 71.1, r: 46 },
    { x: 62.5, y: 81.1, r: 40 },
    { x: 17.4, y: 48.9, r: 40 },
  ],
  add: { x: 81.9, y: 80, r: 36 },
  dock: { y: 90.2, r: 30, step: 96 },
  ring: { gap: 76, button: 56, step: 0.6 },
  chain: 36,
};

/** Desktop layout from this width up (Tailwind `lg`). */
export const DESKTOP_MIN_WIDTH = 1024;

export function pickLayout(w: number): PlanetLayout {
  return w >= DESKTOP_MIN_WIDTH ? DESKTOP_LAYOUT : PHONE_LAYOUT;
}

/** How much to scale radii for a stage of this size (planets grow a bit on big screens). */
export function layoutScale(layout: PlanetLayout, w: number, h: number): number {
  const k = Math.min(w / layout.ref.w, h / layout.ref.h);
  return Math.min(1.2, Math.max(0.8, k));
}

export function toPx(body: Body, w: number, h: number, k: number): Body {
  return { x: (body.x / 100) * w, y: (body.y / 100) * h, r: body.r * k };
}

// ── Seating ─────────────────────────────────────────────────────────────────────────────────

/** Who sits on the orbit, and when each person was last touched (dragged, opened, linked). */
export type Seating = { seats: string[]; touch: Record<string, number>; tick: number };

export const MAX_SEATS = PHONE_LAYOUT.seats.length;

/** Up to MAX_SEATS people all fit; beyond that one seat is given up for the "+N" planet. */
export function seatCount(people: number): number {
  return people <= MAX_SEATS ? people : MAX_SEATS - 1;
}

/**
 * Seats for these people (closest first), keeping a previous seating where it still applies:
 * people who are gone leave their seat, empty seats go to the closest people not yet seated.
 */
export function initialSeating(ids: readonly string[], saved?: Seating | null): Seating {
  const n = seatCount(ids.length);
  const known = new Set(ids);
  const seats = (saved?.seats ?? []).filter((id) => known.has(id)).slice(0, n);
  for (const id of ids) {
    if (seats.length >= n) break;
    if (!seats.includes(id)) seats.push(id);
  }
  const touch: Record<string, number> = {};
  for (const id of ids) if (saved?.touch[id] !== undefined) touch[id] = saved.touch[id];
  return { seats, touch, tick: saved?.tick ?? 0 };
}

/**
 * Brings people onto the orbit: each one not yet seated takes the seat of whoever was touched
 * longest ago (never one of the people being brought in). Everyone named counts as touched.
 */
export function bringIn(seating: Seating, ids: readonly string[]): Seating {
  const seats = [...seating.seats];
  const touch = { ...seating.touch };
  let tick = seating.tick;
  for (const id of ids) {
    if (!seats.includes(id) && seats.length > 0) {
      let seat = -1;
      let oldest = Infinity;
      seats.forEach((sid, i) => {
        if (ids.includes(sid)) return;
        const t = touch[sid] ?? 0;
        if (t < oldest) {
          oldest = t;
          seat = i;
        }
      });
      if (seat >= 0) seats[seat] = id;
    }
    tick += 1;
    touch[id] = tick;
  }
  return { seats, touch, tick };
}

// ── Links ───────────────────────────────────────────────────────────────────────────────────

/** A pair between two people (not me): bought (purchaseId) or only drawn by the user. */
export type PairLink = { a: string; b: string; purchaseId: string | null };

export const pairKey = (a: string, b: string) => [a, b].sort().join("|");

/**
 * Splits pairs into those drawn between two planets on screen, and those with someone hidden
 * in "+N" — folded into the visible person's line to "+N". Pairs of two hidden people wait.
 */
export function arrangeLinks(
  links: readonly PairLink[],
  isShown: (id: string) => boolean,
): { drawn: PairLink[]; folded: Map<string, PairLink[]> } {
  const drawn: PairLink[] = [];
  const folded = new Map<string, PairLink[]>();
  for (const link of links) {
    const a = isShown(link.a);
    const b = isShown(link.b);
    if (a && b) drawn.push(link);
    else if (a || b) {
      const visible = a ? link.a : link.b;
      folded.set(visible, [...(folded.get(visible) ?? []), link]);
    }
  }
  return { drawn, folded };
}

// ── Geometry ────────────────────────────────────────────────────────────────────────────────

/** A straight line as a rotated box: start point, length and angle in degrees. */
export function lineBetween(a: Point, b: Point): { x: number; y: number; length: number; angle: number } {
  return {
    x: a.x,
    y: a.y,
    length: Math.hypot(b.x - a.x, b.y - a.y),
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  };
}

/** Halfway along the part of the line between two circles (`gapA` keeps clear of a halo). */
export function chainPoint(a: Body, b: Body, gapA = 0): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: a.x, y: a.y };
  const free = Math.max(0, len - a.r - gapA - b.r);
  const d = a.r + gapA + free / 2;
  return { x: a.x + (dx / len) * d, y: a.y + (dy / len) * d };
}

/**
 * Where reading buttons sit around a planet: fanned out on the side facing the stage centre,
 * so a planet near an edge keeps its buttons on screen. Around "me" they take the four corners.
 */
export function ringAngles(body: Point, center: Point, n: number, isMe: boolean, step = 0.55): number[] {
  if (isMe) {
    const corners = [-2.4, -0.75, 0.75, 2.4, Math.PI, 0];
    return corners.slice(0, n);
  }
  const base = Math.atan2(center.y - body.y, center.x - body.x);
  return Array.from({ length: n }, (_, i) => base + (i - (n - 1) / 2) * step);
}

/** The nearest body overlapping a dragged planet, if any. */
export function dropTarget(
  dragged: Body,
  bodies: ReadonlyArray<{ id: string; body: Body }>,
  slack = 24,
): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const { id, body } of bodies) {
    const d = Math.hypot(body.x - dragged.x, body.y - dragged.y);
    if (d < body.r + dragged.r + slack && d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}
