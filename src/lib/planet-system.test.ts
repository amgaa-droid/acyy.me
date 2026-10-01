import { describe, expect, it } from "vitest";

import {
  DESKTOP_LAYOUT,
  MAX_SEATS,
  PHONE_LAYOUT,
  arrangeLinks,
  bringIn,
  chainPoint,
  dropTarget,
  initialSeating,
  layoutScale,
  lineBetween,
  pickLayout,
  ringAngles,
  seatCount,
} from "./planet-system";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe("layouts", () => {
  it("have a seat for every planet, sizes all different", () => {
    for (const layout of [PHONE_LAYOUT, DESKTOP_LAYOUT]) {
      expect(layout.seats).toHaveLength(MAX_SEATS);
      expect(new Set(layout.seats.map((s) => s.r)).size).toBeGreaterThan(MAX_SEATS - 2);
    }
  });

  it("switch to desktop at lg and scale within bounds", () => {
    expect(pickLayout(390)).toBe(PHONE_LAYOUT);
    expect(pickLayout(1024)).toBe(DESKTOP_LAYOUT);
    expect(layoutScale(PHONE_LAYOUT, 390, 844)).toBe(1);
    expect(layoutScale(PHONE_LAYOUT, 320, 568)).toBe(0.8);
    expect(layoutScale(DESKTOP_LAYOUT, 3000, 2000)).toBe(1.2);
  });
});

describe("seating", () => {
  it("seats everyone up to the max, otherwise one seat less for +N", () => {
    expect(seatCount(3)).toBe(3);
    expect(seatCount(MAX_SEATS)).toBe(MAX_SEATS);
    expect(seatCount(MAX_SEATS + 1)).toBe(MAX_SEATS - 1);
  });

  it("starts with the closest people and keeps a saved seating that still applies", () => {
    expect(initialSeating(ids(9)).seats).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    const saved = { seats: ["p9", "gone", "p2"], touch: { p9: 3, gone: 9 }, tick: 9 };
    const s = initialSeating(ids(9), saved);
    expect(s.seats).toEqual(["p9", "p2", "p1", "p3", "p4"]);
    expect(s.touch).toEqual({ p9: 3 });
  });

  it("brings someone in by taking the seat touched longest ago; the others stay put", () => {
    const s = { seats: ["p1", "p2", "p3", "p4", "p5"], touch: { p1: 5, p2: 1, p3: 4, p4: 3, p5: 2 }, tick: 5 };
    const next = bringIn(s, ["p8"]);
    expect(next.seats).toEqual(["p1", "p8", "p3", "p4", "p5"]);
    expect(next.touch.p8).toBe(6);
  });

  it("never evicts someone it is bringing in together", () => {
    const s = { seats: ["p1", "p2"], touch: { p1: 1, p2: 2 }, tick: 2 };
    // p1 is the oldest but is part of this pair, so p2's seat goes to p7.
    expect(bringIn(s, ["p1", "p7"]).seats).toEqual(["p1", "p7"]);
  });

  it("only touches people already seated", () => {
    const s = { seats: ["p1", "p2"], touch: {}, tick: 0 };
    expect(bringIn(s, ["p2"])).toEqual({ seats: ["p1", "p2"], touch: { p2: 1 }, tick: 1 });
  });
});

describe("arrangeLinks", () => {
  const shown = new Set(["a", "b"]);
  const links = [
    { a: "a", b: "b", purchaseId: "1" },
    { a: "a", b: "x", purchaseId: null },
    { a: "y", b: "a", purchaseId: "2" },
    { a: "x", b: "y", purchaseId: null },
  ];

  it("draws pairs between shown planets and folds the rest into the visible person", () => {
    const { drawn, folded } = arrangeLinks(links, (id) => shown.has(id));
    expect(drawn).toEqual([links[0]]);
    expect(folded.get("a")).toEqual([links[1], links[2]]);
    expect(folded.size).toBe(1);
  });
});

describe("geometry", () => {
  it("measures a line", () => {
    expect(lineBetween({ x: 0, y: 0 }, { x: 0, y: 10 })).toEqual({ x: 0, y: 0, length: 10, angle: 90 });
  });

  it("puts the chain halfway between the two circles", () => {
    // visible part 10..80 (+gap 10 → 20..80) → middle 50
    expect(chainPoint({ x: 0, y: 0, r: 10 }, { x: 100, y: 0, r: 20 }, 10)).toEqual({ x: 50, y: 0 });
  });

  it("fans reading buttons toward the centre", () => {
    const [first, , , last] = ringAngles({ x: 0, y: 0 }, { x: 100, y: 0 }, 4, false, 0.5);
    expect(first).toBeCloseTo(-0.75);
    expect(last).toBeCloseTo(0.75);
    expect(ringAngles({ x: 0, y: 0 }, { x: 0, y: 0 }, 3, true)).toHaveLength(3);
  });

  it("finds the nearest overlapping body to drop on", () => {
    const bodies = [
      { id: "far", body: { x: 500, y: 0, r: 40 } },
      { id: "near", body: { x: 60, y: 0, r: 30 } },
    ];
    expect(dropTarget({ x: 0, y: 0, r: 30 }, bodies)).toBe("near");
    expect(dropTarget({ x: 0, y: 300, r: 30 }, bodies)).toBeNull();
  });
});
