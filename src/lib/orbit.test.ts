import { describe, expect, it } from "vitest";

import {
  LABEL_H,
  ORBIT_DESKTOP,
  ORBIT_MAX,
  ORBIT_MOBILE,
  ORBIT_MOTION,
  badgePoint,
  labelAbove,
  orbitVisible,
} from "./orbit";

describe("orbitVisible", () => {
  const people = (n: number) => Array.from({ length: n }, (_, i) => i);

  it("shows everyone up to the max", () => {
    expect(orbitVisible(people(0))).toEqual({ shown: [], more: 0 });
    expect(orbitVisible(people(ORBIT_MAX))).toEqual({ shown: people(ORBIT_MAX), more: 0 });
  });

  it("folds the rest into +N in the last slot when there are more", () => {
    expect(orbitVisible(people(7))).toEqual({ shown: people(5), more: 2 });
    expect(orbitVisible(people(20))).toEqual({ shown: people(5), more: 15 });
  });
});

describe("layouts", () => {
  it("have a slot and a motion for every visible planet", () => {
    expect(ORBIT_MOBILE.slots).toHaveLength(ORBIT_MAX);
    expect(ORBIT_DESKTOP.slots).toHaveLength(ORBIT_MAX);
    expect(ORBIT_MOTION).toHaveLength(ORBIT_MAX);
  });

  it("vary planet sizes (no regular ring)", () => {
    expect(new Set(ORBIT_MOBILE.slots.map((s) => s.size)).size).toBe(ORBIT_MAX);
  });
});

describe("labelAbove", () => {
  const layout = {
    stage: { w: 400, h: 400 },
    me: { x: 50, y: 50, size: 100 },
    slots: [],
    add: { x: 0, y: 0, size: 0 },
  };

  it("puts the caption above a planet above me when there is room", () => {
    expect(labelAbove(layout, { x: 20, y: 30, size: 40 })).toBe(true);
  });

  it("keeps it below near the top edge and for planets below me", () => {
    expect(labelAbove(layout, { x: 20, y: 5, size: 40 })).toBe(false);
    expect(labelAbove(layout, { x: 20, y: 80, size: 40 })).toBe(false);
  });
});

describe("badgePoint", () => {
  const layout = {
    stage: { w: 100, h: 100 },
    me: { x: 0, y: 50, size: 20 },
    slots: [],
    add: { x: 0, y: 0, size: 0 },
  };

  it("sits halfway along the visible part of the line, between the two circles", () => {
    // me radius 10 + halo 10 = 20, planet radius 10 at distance 100 → visible 20..90, middle 55.
    expect(badgePoint(layout, { x: 100, y: 50, size: 20 })).toEqual({ x: 55, y: 50 });
  });

  it("keeps clear of a caption hanging toward me", () => {
    const big = { ...layout, stage: { w: 400, h: 400 }, me: { x: 50, y: 90, size: 20 } };
    const planet = { x: 50, y: 10, size: 20 }; // 320 px straight above me, caption below it
    expect(labelAbove(big, planet)).toBe(false);
    const p = badgePoint(big, planet);
    const fromPlanet = ((p.y - planet.y) / 100) * 400;
    expect(fromPlanet).toBeGreaterThan(planet.size / 2 + LABEL_H);
  });

  it("never lands on a caption and stays between me and the planet on the real layouts", () => {
    for (const layout of [ORBIT_MOBILE, ORBIT_DESKTOP]) {
      for (const slot of layout.slots) {
        const p = badgePoint(layout, slot);
        const between = (a: number, b: number, v: number) =>
          v >= Math.min(a, b) && v <= Math.max(a, b);
        expect(between(layout.me.x, slot.x, p.x)).toBe(true);
        expect(between(layout.me.y, slot.y, p.y)).toBe(true);
      }
    }
  });
});
