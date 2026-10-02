/**
 * Home planet system: "me" in the middle of a full-screen stage, people as planets around.
 * Pure geometry and seating rules — the React component (src/components/home/planet-system.tsx)
 * only measures the screen and wires events.
 *
 * Planet positions are % of the stage (so they survive a resize); radii are px at the layout's
 * reference size and get scaled.
 */

export type Body = { x: number; y: number; r: number };
export type Point = { x: number; y: number };

export type LayoutKey = "phone" | "desktop";

export type PlanetLayout = {
  key: LayoutKey;
  ref: { w: number; h: number };
  me: Body;
  /** The "+N" planet and the "add a person" planet stay put. */
  more: Body;
  add: Body;
  /** Planet radii by closeness: the closest person is the biggest. */
  sizes: number[];
  /** Space kept free for the top bar, the hint line and the screen sides (px). */
  safe: { top: number; bottom: number; side: number };
  dock: { y: number; r: number; step: number };
  /** Reading buttons around a selected planet: distance from its edge, size, angle between. */
  ring: { gap: number; button: number; step: number };
  chain: number;
};

export const PHONE_LAYOUT: PlanetLayout = {
  key: "phone",
  ref: { w: 390, h: 844 },
  me: { x: 50, y: 49.8, r: 64 },
  more: { x: 11.8, y: 46, r: 28 },
  add: { x: 86.2, y: 80.6, r: 28 },
  sizes: [42, 38, 36, 34, 32, 30],
  safe: { top: 128, bottom: 72, side: 10 },
  dock: { y: 90.3, r: 26, step: 68 },
  ring: { gap: 60, button: 54, step: 0.8 },
  chain: 30,
};

export const DESKTOP_LAYOUT: PlanetLayout = {
  key: "desktop",
  ref: { w: 1440, h: 900 },
  me: { x: 50, y: 50, r: 104 },
  more: { x: 17.4, y: 48.9, r: 40 },
  add: { x: 81.9, y: 80, r: 36 },
  sizes: [60, 56, 52, 48, 44, 40],
  safe: { top: 140, bottom: 84, side: 32 },
  dock: { y: 90.2, r: 30, step: 96 },
  ring: { gap: 76, button: 56, step: 0.6 },
  chain: 36,
};

/** Desktop layout from this width up (Tailwind `lg`). */
const DESKTOP_MIN_WIDTH = 1024;

export function pickLayout(w: number): PlanetLayout {
  return w >= DESKTOP_MIN_WIDTH ? DESKTOP_LAYOUT : PHONE_LAYOUT;
}

/** How much to scale radii for a stage of this size (planets grow a bit on big screens). */
export function layoutScale(layout: PlanetLayout, w: number, h: number): number {
  const k = Math.min(w / layout.ref.w, h / layout.ref.h);
  return Math.min(1.2, Math.max(0.8, k));
}

export function toPx(p: Point, w: number, h: number): Point {
  return { x: (p.x / 100) * w, y: (p.y / 100) * h };
}

export function toPct(p: Point, w: number, h: number): Point {
  const round = (n: number) => Math.round(n * 100) / 100;
  return { x: round((p.x / w) * 100), y: round((p.y / h) * 100) };
}

export function bodyPx(body: Body, w: number, h: number, k: number): Body {
  return { ...toPx(body, w, h), r: body.r * k };
}

// ── "Today" view ────────────────────────────────────────────────────────────────────────────

/** The space under "me" for its name and sign pills (px). */
const TODAY_CAPTION = 64;

/**
 * Home's "today" view: "me" big, my daily horoscopes beside it. Phone: me at the top centre,
 * the cards below. Desktop: the cards in a column on the left, me large on the right.
 * `panel` is the cards' scroll area (px from the stage's top-left; `bottom` from its bottom).
 */
export function todayLayout(
  w: number,
  h: number,
): { me: Body; panel: { left: number; top: number; width: number; bottom: number } } {
  if (w < DESKTOP_MIN_WIDTH) {
    const r = Math.round(Math.max(72, Math.min(116, w * 0.27, h * 0.14)));
    const y = 92 + r;
    return {
      me: { x: w / 2, y, r },
      panel: { left: 16, top: y + r + TODAY_CAPTION, width: w - 32, bottom: 0 },
    };
  }
  const left = 32;
  const width = Math.round(Math.min(520, w * 0.42));
  const from = left + width + 48;
  const region = w - 32 - from;
  const r = Math.round(Math.max(110, Math.min(240, region * 0.36, h * 0.3)));
  return {
    me: { x: from + region / 2, y: Math.min(h * 0.47, h - r - TODAY_CAPTION - 24), r },
    panel: { left, top: 152, width, bottom: 32 },
  };
}

/** Keeps a planet of radius r (plus its name below) inside the stage's free area. */
export function clampToStage(p: Point, r: number, w: number, h: number, layout: PlanetLayout): Point {
  const { top, bottom, side } = layout.safe;
  const label = 30;
  return {
    x: Math.min(w - side - r, Math.max(side + r, p.x)),
    y: Math.min(h - bottom - r - label, Math.max(top + r, p.y)),
  };
}

/**
 * Scatters planets that have no place yet at random spots of the free area, away from the
 * bodies already there (me, "+N", "add", earlier planets) with room for their names.
 * `rand` is injectable for tests.
 */
export function scatter(
  items: ReadonlyArray<{ id: string; r: number }>,
  taken: readonly Body[],
  w: number,
  h: number,
  layout: PlanetLayout,
  rand: () => number = Math.random,
): Record<string, Point> {
  const placed: Record<string, Point> = {};
  const bodies = [...taken];
  const { top, bottom, side } = layout.safe;
  const label = 30;
  for (const { id, r } of items) {
    let best: Point | null = null;
    let bestClearance = -Infinity;
    for (let i = 0; i < 400; i++) {
      const p = {
        x: side + r + rand() * Math.max(1, w - 2 * (side + r)),
        y: top + r + rand() * Math.max(1, h - top - bottom - 2 * r - label),
      };
      // Clearance to the nearest body, counting a name's height below each.
      const clearance = Math.min(
        Infinity,
        ...bodies.map((b) => Math.hypot(b.x - p.x, (b.y - p.y) * 1.2) - b.r - r),
      );
      if (clearance > bestClearance) {
        bestClearance = clearance;
        best = p;
      }
      if (clearance > 44) break;
    }
    const p = best ?? { x: w / 2, y: h / 2 };
    placed[id] = toPct(p, w, h);
    bodies.push({ ...p, r });
  }
  return placed;
}

/**
 * Circles covering the name pill under "me", so scattered planets keep clear of it too.
 * `width` is the pill's width in px.
 */
export function captionBodies(me: Body, width: number): Body[] {
  const r = 22;
  const y = me.y + me.r + 8;
  const n = Math.max(1, Math.ceil(width / (2 * r)));
  return Array.from({ length: n }, (_, i) => ({ x: me.x - width / 2 + r + (i * (width - 2 * r)) / Math.max(1, n - 1), y, r }));
}

// ── Seating ─────────────────────────────────────────────────────────────────────────────────

/** Who orbits (the rest wait in "+N"), and when each person was last touched. */
export type Seating = { seats: string[]; touch: Record<string, number>; tick: number };

/** At most this many planets around me, counting the "+N" planet. */
export const MAX_PLANETS = 6;

/**
 * How many people orbit: everyone who may, when they fit; one seat less whenever "+N" is needed
 * (too many people, or someone who always waits there).
 */
export function seatCount(orbiting: number, offOrbit = 0): number {
  if (orbiting <= MAX_PLANETS && offOrbit === 0) return orbiting;
  return Math.min(orbiting, MAX_PLANETS - 1);
}

/**
 * Seats for the people who may orbit (closest first), keeping a previous seating where it still
 * applies: people who are gone leave their seat, empty seats go to the closest unseated.
 */
export function initialSeating(
  ids: readonly string[],
  saved?: Seating | null,
  offOrbit = 0,
): Seating {
  const n = seatCount(ids.length, offOrbit);
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
 * `swaps` says who replaced whom, so the newcomer can take over their place on screen.
 */
export function bringIn(
  seating: Seating,
  ids: readonly string[],
): Seating & { swaps: Array<[string, string]> } {
  const seats = [...seating.seats];
  const touch = { ...seating.touch };
  const swaps: Array<[string, string]> = [];
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
      if (seat >= 0) {
        swaps.push([id, seats[seat]]);
        seats[seat] = id;
      }
    }
    tick += 1;
    touch[id] = tick;
  }
  return { seats, touch, tick, swaps };
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

/**
 * A line between two circles as a rotated box, from one rim to the other (not centre to
 * centre): start point, length and angle in degrees.
 */
export function rimLine(a: Body, b: Body): { x: number; y: number; length: number; angle: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (len === 0) return { x: a.x, y: a.y, length: 0, angle };
  const ux = dx / len;
  const uy = dy / len;
  return {
    x: a.x + ux * a.r,
    y: a.y + uy * a.r,
    length: Math.max(0, len - a.r - b.r),
    angle,
  };
}

/** A point along the part of the line between two circles (`t` = 0.5: halfway). */
export function chainPoint(a: Body, b: Body, t = 0.5): Point {
  const l = rimLine(a, b);
  const rad = (l.angle * Math.PI) / 180;
  return { x: l.x + Math.cos(rad) * l.length * t, y: l.y + Math.sin(rad) * l.length * t };
}

/**
 * Where reading buttons sit around a planet: fanned out on the side facing the stage centre,
 * so a planet near an edge keeps its buttons on screen. Around "me" they take the corners.
 */
export function ringAngles(body: Point, center: Point, n: number, isMe: boolean, step = 0.55): number[] {
  if (isMe) {
    const corners = [-2.4, -0.75, 0.75, 2.4, Math.PI, 0];
    return corners.slice(0, n);
  }
  const base = Math.atan2(center.y - body.y, center.x - body.x);
  return Array.from({ length: n }, (_, i) => base + (i - (n - 1) / 2) * step);
}

/**
 * Turns a fan of buttons (at distance `rr` around `body`) as little as needed for every button
 * to stay inside the box, closing the fan up a little if no turn fits (a planet in a corner);
 * falls back to the original angles if nothing fits.
 */
export function fitRing(
  body: Point,
  rr: number,
  angles: readonly number[],
  box: { left: number; top: number; right: number; bottom: number },
): number[] {
  const fits = (as: number[]) =>
    as.every((a) => {
      const x = body.x + Math.cos(a) * rr;
      const y = body.y + Math.sin(a) * rr;
      return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    });
  const mid = angles.length ? (angles[0] + angles[angles.length - 1]) / 2 : 0;
  // Turn first; only if no turn fits, close the fan up a little and try again.
  for (const squeeze of [1, 0.85, 0.72, 0.6]) {
    const fan = angles.map((a) => mid + (a - mid) * squeeze);
    for (let i = 0; i <= 20; i++) {
      for (const sign of i === 0 ? [1] : [1, -1]) {
        const turned = fan.map((a) => a + sign * i * 0.1);
        if (fits(turned)) return turned;
      }
    }
  }
  return [...angles];
}

/** The nearest body overlapping a dragged planet, if any. */
export function dropTarget(
  dragged: Body,
  bodies: ReadonlyArray<{ id: string; body: Body }>,
  slack = 16,
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
