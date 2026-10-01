/**
 * Home "orbit": the user in the middle, their people as planets scattered around at uneven
 * positions and sizes. Positions are % of the stage; sizes are px. Two hand-tuned layouts —
 * a portrait one for phones and a landscape one for desktop (lg) — share the same slot order.
 */

export type OrbitPoint = { x: number; y: number };
export type OrbitBody = OrbitPoint & { size: number };

export type OrbitLayout = {
  /** Reference stage size in px — used only to place badges along the lines. */
  stage: { w: number; h: number };
  me: OrbitBody;
  /**
   * Planet slots, closest people first, ordered so that a few people still spread around me
   * (upper-left, then right, …). The last one holds "+N" when people overflow.
   */
  slots: OrbitBody[];
  add: OrbitBody;
};

export const ORBIT_MOBILE: OrbitLayout = {
  stage: { w: 350, h: 490 },
  me: { x: 50, y: 46, size: 118 },
  slots: [
    { x: 24, y: 22, size: 70 },
    { x: 83, y: 58, size: 76 },
    { x: 79, y: 22, size: 58 },
    { x: 20, y: 71, size: 62 },
    { x: 58, y: 81, size: 50 },
    { x: 52, y: 6, size: 44 },
  ],
  add: { x: 11, y: 47, size: 52 },
};

export const ORBIT_DESKTOP: OrbitLayout = {
  stage: { w: 1100, h: 560 },
  me: { x: 64, y: 47, size: 156 },
  slots: [
    { x: 46, y: 22, size: 80 },
    { x: 89, y: 40, size: 88 },
    { x: 77, y: 19, size: 64 },
    { x: 54, y: 83, size: 54 },
    { x: 81, y: 79, size: 62 },
    { x: 94, y: 74, size: 50 },
  ],
  add: { x: 45, y: 60, size: 60 },
};

/** Per-slot float style, so neighbours never move in step. */
export const ORBIT_MOTION = [
  { drift: "a", delay: 0, ring: false },
  { drift: "b", delay: -1.5, ring: true },
  { drift: "c", delay: -3, ring: false },
  { drift: "a", delay: -5, ring: false },
  { drift: "c", delay: -7, ring: false },
  { drift: "b", delay: -4, ring: false },
] as const;

export const ORBIT_MAX = ORBIT_MOBILE.slots.length;

/** Everyone fits up to ORBIT_MAX; beyond that the last slot becomes a "+N" planet. */
export function orbitVisible<T>(people: readonly T[], max = ORBIT_MAX): { shown: T[]; more: number } {
  if (people.length <= max) return { shown: [...people], more: 0 };
  return { shown: people.slice(0, max - 1), more: people.length - (max - 1) };
}

const ME_HALO = 10;
/** Height of a planet's caption (name, sign, reading icons) in px. */
export const LABEL_H = 64;

const px = (layout: OrbitLayout, p: OrbitPoint) => ({
  x: (p.x / 100) * layout.stage.w,
  y: (p.y / 100) * layout.stage.h,
});

/**
 * A caption goes above a planet that is above "me" (so the line to me never runs through it),
 * unless there is no room above; otherwise below.
 */
export function labelAbove(layout: OrbitLayout, body: OrbitBody): boolean {
  return body.y < layout.me.y && px(layout, body).y - body.size / 2 - LABEL_H >= 0;
}

/**
 * Where a pair badge sits on the line from "me" to a planet: halfway along the part of the line
 * that is free — between the two circles and clear of the planet's caption. When nothing is
 * free it hugs "me". Returned in % of the stage.
 */
export function badgePoint(layout: OrbitLayout, body: OrbitBody): OrbitPoint {
  const me = px(layout, layout.me);
  const p = px(layout, body);
  const len = Math.hypot(p.x - me.x, p.y - me.y);
  if (len === 0) return { x: body.x, y: body.y };
  const rMe = layout.me.size / 2 + ME_HALO;
  // The caption faces me when it hangs below a planet that sits above me (or the reverse).
  const towardMe = me.y - p.y;
  const above = labelAbove(layout, body);
  const facing = (above && towardMe < 0) || (!above && towardMe > 0);
  const captionClear = facing ? ((body.size / 2 + LABEL_H) * len) / Math.abs(towardMe) : 0;
  const clear = Math.max(body.size / 2, captionClear);
  const free = len - clear - rMe;
  const d = free >= 28 ? rMe + free / 2 : rMe + 14;
  const t = d / len;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    x: round(layout.me.x + (body.x - layout.me.x) * t),
    y: round(layout.me.y + (body.y - layout.me.y) * t),
  };
}
