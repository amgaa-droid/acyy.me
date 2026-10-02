import type { Body, Point } from "./planet-system";

/**
 * Where the landing's example people sit around "Та": a fresh random arrangement on every
 * visit, inside the free band between the headline and the hint line. Linked people sit next
 * to each other so their link lines don't cross "Та", and nothing covers anything else: the
 * people with their captions, "Та" with its "pick your birthday" button, the link chips.
 */

type SeatItem = { id: string; r: number };

export type SeatStage = {
  w: number;
  h: number;
  /** Free band (px): below the headline, above the hint line. */
  top: number;
  bottom: number;
  side: number;
  /** "Та" and the room kept free around it. */
  me: Body;
  keepOut: number;
  /** The button hanging below "Та": its size and how far below the centre its top is. */
  pill: { w: number; h: number; dy: number };
  /** How far from "Та" a seat may be (px): about the outer orbit, so nobody drifts off. */
  reach?: number;
};

/** Name and date caption under each person, and a link's chip (px). */
export const SEAT_LABEL = { w: 104, h: 36 };
export const CHIP = { w: 100, h: 26 };
/** A seat may sit this much beyond `reach`. */
export const REACH_SLACK = 1.08;
const GAP = 6;

/** Orders people so that linked ones are neighbours: walks each chain from one of its ends. */
export function orderByLinks(
  ids: readonly string[],
  links: ReadonlyArray<{ a: string; b: string }>,
): string[] {
  const adj = new Map(ids.map((id) => [id, [] as string[]]));
  for (const { a, b } of links) {
    if (a === b || !adj.has(a) || !adj.has(b)) continue;
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  }
  const left = new Set(ids);
  const degree = (id: string) => adj.get(id)!.filter((n) => left.has(n)).length;
  const out: string[] = [];
  while (left.size > 0) {
    // Array.prototype.sort is stable: ties keep the CMS order.
    let cur: string | undefined = [...left].sort((x, y) => degree(x) - degree(y))[0];
    while (cur) {
      out.push(cur);
      left.delete(cur);
      cur = adj.get(cur)!.find((n) => left.has(n));
    }
  }
  return out;
}

type Box = { left: number; right: number; top: number; bottom: number };

/** A person with its caption, as a box. */
function boxOf(p: Body): Box {
  const half = Math.max(p.r, SEAT_LABEL.w / 2);
  return { left: p.x - half, right: p.x + half, top: p.y - p.r, bottom: p.y + p.r + SEAT_LABEL.h };
}

/** Just the name and date under a person. */
function captionOf(p: Body): Box {
  return { left: p.x - SEAT_LABEL.w / 2, right: p.x + SEAT_LABEL.w / 2, top: p.y + p.r, bottom: p.y + p.r + SEAT_LABEL.h };
}

const centred = (c: Point, w: number, h: number): Box => ({
  left: c.x - w / 2,
  right: c.x + w / 2,
  top: c.y - h / 2,
  bottom: c.y + h / 2,
});

const overlaps = (a: Box, b: Box) =>
  a.left < b.right + GAP && b.left < a.right + GAP && a.top < b.bottom + GAP && b.top < a.bottom + GAP;

/** Distance from a point to the nearest point of a box (0 inside). */
function distToBox(c: Point, b: Box): number {
  const dx = Math.max(b.left - c.x, 0, c.x - b.right);
  const dy = Math.max(b.top - c.y, 0, c.y - b.bottom);
  return Math.hypot(dx, dy);
}

const pillBox = ({ me, pill }: SeatStage): Box => ({
  left: me.x - pill.w / 2,
  right: me.x + pill.w / 2,
  top: me.y + pill.dy,
  bottom: me.y + pill.dy + pill.h,
});

/** Clear of "Та" (its circle plus the kept room) and of the button below it. */
const clearOfMe = (b: Box, stage: SeatStage) =>
  distToBox(stage.me, b) >= stage.me.r + stage.keepOut && !overlaps(b, pillBox(stage));

/** The person moved (if needed) so it and its caption lie inside the band. */
function clampToBand(p: Body, stage: SeatStage): Body {
  const half = Math.max(p.r, SEAT_LABEL.w / 2);
  return {
    r: p.r,
    x: Math.min(stage.w - stage.side - half, Math.max(stage.side + half, p.x)),
    y: Math.min(stage.bottom - SEAT_LABEL.h - p.r, Math.max(stage.top + p.r, p.y)),
  };
}

/** True when the person (with its caption) stays inside the band and clear of "Та". */
export function seatFits(p: Body, stage: SeatStage): boolean {
  const box = boxOf(p);
  if (box.left < stage.side - 0.5 || box.right > stage.w - stage.side + 0.5) return false;
  if (box.top < stage.top - 0.5 || box.bottom > stage.bottom + 0.5) return false;
  return clearOfMe(box, stage);
}

/**
 * Where a link's chip sits on the line between the two rims: halfway, or as near halfway as
 * keeps it off both people's captions (a steep link would otherwise put it on the upper one's).
 */
export function chipCentre(a: Body, b: Body): Point {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const at = (t: number): Point => {
    const k = (a.r + (d - a.r - b.r) * t) / d;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };
  const ts = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82];
  const offCaptions = (chip: Box) => !overlaps(chip, captionOf(a)) && !overlaps(chip, captionOf(b));
  const offCircles = (chip: Box) => distToBox(a, chip) >= a.r && distToBox(b, chip) >= b.r;
  // Best: clear of both people; else clear of their captions at least.
  for (const strict of [true, false])
    for (const t of ts) {
      const chip = centred(at(t), CHIP.w, CHIP.h);
      if (offCaptions(chip) && (!strict || offCircles(chip))) return at(t);
    }
  return at(0.5);
}

/**
 * Random seats (px) for the items, which come in neighbour order (see orderByLinks); `links`
 * are pairs of item ids whose chips must stay clear too. Each try spreads the people evenly
 * round "Та" from a random start angle and direction, with some jitter in angle and distance,
 * pulled back inside the band; a try where anything covers anything else is thrown away. If no
 * random try fits, one of the evenly spaced rings that fit is picked. Returns null when nothing
 * fits (a very small screen). `rand` is injectable for tests.
 */
export function ringSeats(
  items: readonly SeatItem[],
  stage: SeatStage,
  links: ReadonlyArray<readonly [string, string]> = [],
  rand: () => number = Math.random,
  tries = 400,
): Record<string, Point> | null {
  if (items.length === 0) return {};
  const { me } = stage;
  // One empty slot keeps the two ends of a chain apart.
  const step = (2 * Math.PI) / (items.length + 1);
  const index = new Map(items.map((it, i) => [it.id, i]));
  const pairs = links
    .map(([a, b]) => [index.get(a), index.get(b)] as const)
    .filter((p): p is readonly [number, number] => p[0] !== undefined && p[1] !== undefined);
  const reach = stage.reach ?? Infinity;
  // Seats slightly past the outer orbit at most.
  const maxDist = reach * REACH_SLACK;
  const rx = Math.min(me.x - stage.side, stage.w - stage.side - me.x, reach);
  const up = Math.min(me.y - stage.top, reach);
  const down = Math.min(stage.bottom - SEAT_LABEL.h - me.y, reach);
  if (rx <= 0 || up <= 0 || down <= 0) return null;

  const chipsClear = (placed: Body[]) => {
    const chips = pairs.map(([i, j]) => centred(chipCentre(placed[i], placed[j]), CHIP.w, CHIP.h));
    return pairs.every(([i, j], n) => {
      const chip = chips[n];
      if (chips.some((other, m) => m !== n && overlaps(chip, other))) return false;
      // The chip sits on its own link line, so it may touch its two people, not their captions.
      return (
        clearOfMe(chip, stage) &&
        placed.every((p, k) => !overlaps(chip, k === i || k === j ? captionOf(p) : boxOf(p)))
      );
    });
  };

  const tryRing = (start: number, dir: number, jitter: number): Body[] | null => {
    const placed: Body[] = [];
    for (let i = 0; i < items.length; i++) {
      const a = start + dir * i * step + (jitter ? (rand() - 0.5) * 2 * jitter * step : 0);
      // Round the orbit, a little inside or beyond it, then pulled back inside the band.
      const s = jitter ? 1.15 - rand() * 0.35 : 1.05;
      const ry = Math.sin(a) < 0 ? up : down;
      const r = items[i].r;
      let x = Math.cos(a) * rx * s;
      let y = Math.sin(a) * ry * s;
      const far = Math.hypot(x, y);
      if (far > maxDist) [x, y] = [(x / far) * maxDist, (y / far) * maxDist];
      let p = clampToBand({ x: me.x + x, y: me.y + y, r }, stage);
      // Too close to "Та" (or its button): step outwards along the same ray while that helps.
      for (let n = 0; n < 16 && !seatFits(p, stage); n++) {
        const d = Math.hypot(p.x - me.x, p.y - me.y) || 1;
        const next = clampToBand({ r, x: p.x + ((p.x - me.x) / d) * 8, y: p.y + ((p.y - me.y) / d) * 8 }, stage);
        if (next.x === p.x && next.y === p.y) break;
        p = next;
      }
      const tooFar = Math.hypot(p.x - me.x, p.y - me.y) > maxDist + 24;
      if (tooFar || !seatFits(p, stage) || placed.some((q) => overlaps(boxOf(p), boxOf(q)))) return null;
      placed.push(p);
    }
    return chipsClear(placed) ? placed : null;
  };
  const result = (placed: Body[]) =>
    Object.fromEntries(items.map((it, i) => [it.id, { x: placed[i].x, y: placed[i].y }]));

  for (let attempt = 0; attempt < tries; attempt++) {
    const placed = tryRing(rand() * 2 * Math.PI, rand() < 0.5 ? 1 : -1, 0.22);
    if (placed) return result(placed);
  }
  // No luck at random (a narrow screen): every evenly spaced ring that fits, both ways round,
  // and one of them picked at random so the layout still changes from visit to visit.
  const fits: Body[][] = [];
  for (let k = 0; k < 72; k++)
    for (const dir of [1, -1]) {
      const placed = tryRing((k * 2 * Math.PI) / 72, dir, 0);
      if (placed) fits.push(placed);
    }
  return fits.length ? result(fits[Math.floor(rand() * fits.length)]) : null;
}
