import { describe, expect, it } from "vitest";

import {
  DESKTOP_LAYOUT,
  MAX_PLANETS,
  PHONE_LAYOUT,
  arrangeLinks,
  bringIn,
  captionBodies,
  chainPoint,
  coachCaptionSide,
  coachStep,
  clampToStage,
  dropTarget,
  fitRing,
  initialSeating,
  layoutScale,
  pickLayout,
  rimLine,
  ringAngles,
  scatter,
  seatCount,
  toPx,
} from "./planet-system";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

/** Deterministic pseudo-random numbers for scatter(). */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe("layouts", () => {
  it("have a size for every planet, closest biggest", () => {
    for (const layout of [PHONE_LAYOUT, DESKTOP_LAYOUT]) {
      expect(layout.sizes).toHaveLength(MAX_PLANETS);
      expect([...layout.sizes].sort((a, b) => b - a)).toEqual(layout.sizes);
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

describe("scatter", () => {
  const w = 390;
  const h = 844;
  const me = { ...toPx(PHONE_LAYOUT.me, w, h), r: 64 };
  const items = ids(5).map((id, i) => ({ id, r: PHONE_LAYOUT.sizes[i] }));

  it("places every planet inside the free area without touching me or each other", () => {
    const placed = scatter(items, [me], w, h, PHONE_LAYOUT, seeded(7));
    const bodies = items.map(({ id, r }) => ({ ...toPx(placed[id], w, h), r }));
    for (const b of bodies) {
      expect(clampToStage(b, b.r, w, h, PHONE_LAYOUT)).toEqual({ x: b.x, y: b.y });
      expect(Math.hypot(b.x - me.x, b.y - me.y)).toBeGreaterThan(b.r + me.r);
    }
    for (let i = 0; i < bodies.length; i++)
      for (let j = i + 1; j < bodies.length; j++)
        expect(Math.hypot(bodies[i].x - bodies[j].x, bodies[i].y - bodies[j].y)).toBeGreaterThan(
          bodies[i].r + bodies[j].r,
        );
  });

  it("differs from one opening to the next", () => {
    expect(scatter(items, [me], w, h, PHONE_LAYOUT, seeded(1))).not.toEqual(
      scatter(items, [me], w, h, PHONE_LAYOUT, seeded(2)),
    );
  });
});

describe("captionBodies", () => {
  it("covers the pill under me from end to end", () => {
    const bodies = captionBodies({ x: 100, y: 100, r: 50 }, 176);
    expect(bodies[0].x - bodies[0].r).toBeCloseTo(12);
    expect(bodies.at(-1)!.x + bodies.at(-1)!.r).toBeCloseTo(188);
    expect(bodies.every((b) => b.y === 158)).toBe(true);
  });
});

describe("seating", () => {
  it("seats everyone who fits, otherwise one seat less for +N", () => {
    expect(seatCount(3)).toBe(3);
    expect(seatCount(MAX_PLANETS)).toBe(MAX_PLANETS);
    expect(seatCount(MAX_PLANETS + 1)).toBe(MAX_PLANETS - 1);
  });

  it("keeps a seat for +N whenever someone always waits there ('Хэн ч биш')", () => {
    expect(seatCount(3, 1)).toBe(3);
    expect(seatCount(MAX_PLANETS, 1)).toBe(MAX_PLANETS - 1);
    expect(initialSeating(ids(6), null, 2).seats).toHaveLength(MAX_PLANETS - 1);
  });

  it("starts with the closest people and keeps a saved seating that still applies", () => {
    expect(initialSeating(ids(9)).seats).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    const saved = { seats: ["p9", "gone", "p2"], touch: { p9: 3, gone: 9 }, tick: 9 };
    const s = initialSeating(ids(9), saved);
    expect(s.seats).toEqual(["p9", "p2", "p1", "p3", "p4"]);
    expect(s.touch).toEqual({ p9: 3 });
  });

  it("brings someone in by taking the seat touched longest ago, and says whose", () => {
    const s = { seats: ["p1", "p2", "p3", "p4", "p5"], touch: { p1: 5, p2: 1, p3: 4, p4: 3, p5: 2 }, tick: 5 };
    const next = bringIn(s, ["p8"]);
    expect(next.seats).toEqual(["p1", "p8", "p3", "p4", "p5"]);
    expect(next.swaps).toEqual([["p8", "p2"]]);
    expect(next.touch.p8).toBe(6);
  });

  it("never evicts someone it is bringing in together", () => {
    const s = { seats: ["p1", "p2"], touch: { p1: 1, p2: 2 }, tick: 2 };
    expect(bringIn(s, ["p1", "p7"]).seats).toEqual(["p1", "p7"]);
  });

  it("only touches people already seated", () => {
    const s = { seats: ["p1", "p2"], touch: {}, tick: 0 };
    expect(bringIn(s, ["p2"])).toEqual({ seats: ["p1", "p2"], touch: { p2: 1 }, tick: 1, swaps: [] });
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
  it("draws a line from rim to rim, not centre to centre", () => {
    expect(rimLine({ x: 0, y: 0, r: 10 }, { x: 0, y: 100, r: 20 })).toEqual({
      x: 0,
      y: 10,
      length: 70,
      angle: 90,
    });
  });

  it("puts the chain halfway between the two rims", () => {
    expect(chainPoint({ x: 0, y: 0, r: 10 }, { x: 100, y: 0, r: 30 })).toEqual({ x: 40, y: 0 });
    expect(chainPoint({ x: 0, y: 0, r: 10 }, { x: 100, y: 0, r: 30 }, 0.75)).toEqual({ x: 55, y: 0 });
  });

  it("keeps a moved planet inside the free area", () => {
    const p = clampToStage({ x: -50, y: 2000 }, 30, 390, 844, PHONE_LAYOUT);
    expect(p.x).toBe(PHONE_LAYOUT.safe.side + 30);
    expect(p.y).toBe(844 - PHONE_LAYOUT.safe.bottom - 30 - 30);
  });

  it("fans reading buttons toward the centre", () => {
    const [first, , , last] = ringAngles({ x: 0, y: 0 }, { x: 100, y: 0 }, 4, false, 0.5);
    expect(first).toBeCloseTo(-0.75);
    expect(last).toBeCloseTo(0.75);
    expect(ringAngles({ x: 0, y: 0 }, { x: 0, y: 0 }, 3, true)).toHaveLength(3);
  });

  it("turns a fan of buttons just enough to keep them all on screen", () => {
    const box = { left: 0, top: 0, right: 100, bottom: 100 };
    const fan = [-0.4, 0, 0.4];
    // Around a planet near the right edge, buttons pointing right would fall off.
    const turned = fitRing({ x: 80, y: 50 }, 30, fan, box);
    for (const a of turned) {
      const x = 80 + Math.cos(a) * 30;
      const y = 50 + Math.sin(a) * 30;
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
    expect(fitRing({ x: 50, y: 50 }, 30, fan, box)).toEqual(fan);
  });

  it("closes the fan up for a planet in a corner", () => {
    const box = { left: 0, top: 0, right: 100, bottom: 100 };
    const fan = [0, 0.8, 1.6, 2.4]; // a wide fan
    const turned = fitRing({ x: 85, y: 15 }, 40, fan, box);
    expect(turned.at(-1)! - turned[0]).toBeLessThan(2.4);
    for (const a of turned) {
      expect(85 + Math.cos(a) * 40).toBeLessThanOrEqual(100);
      expect(15 + Math.sin(a) * 40).toBeGreaterThanOrEqual(0);
    }
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

describe("first-run guide", () => {
  it("asks to add someone first, then to drag them onto me", () => {
    expect(coachStep({ people: 0, pairs: 0, flags: {} })).toBe("add");
    expect(coachStep({ people: 1, pairs: 0, flags: { add: true } })).toBe("link");
  });

  it("stays away from someone who has done it or dismissed it", () => {
    expect(coachStep({ people: 2, pairs: 1, flags: {} })).toBeNull();
    expect(coachStep({ people: 1, pairs: 0, flags: { link: true } })).toBeNull();
    // Deleted everyone after the guide: don't start over.
    expect(coachStep({ people: 0, pairs: 0, flags: { add: true } })).toBeNull();
  });

  it("puts the caption beside the target, toward the middle", () => {
    expect(coachCaptionSide({ x: 330, y: 680, r: 28 }, 390, 844)).toBe("left");
    expect(coachCaptionSide({ x: 50, y: 400, r: 28 }, 390, 844)).toBe("right");
    expect(coachCaptionSide({ x: 195, y: 600, r: 28 }, 390, 844)).toBe("above");
    expect(coachCaptionSide({ x: 195, y: 150, r: 28 }, 390, 844)).toBe("below");
  });
});
