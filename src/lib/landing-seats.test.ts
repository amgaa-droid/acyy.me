import { describe, expect, it } from "vitest";

import { CHIP, SEAT_LABEL, chipCentre, orderByLinks, ringSeats, seatFits, type SeatStage } from "./landing-seats";

/** Small deterministic PRNG (mulberry32) so the random layouts are reproducible. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PEOPLE = ["mom", "dad", "love", "friend", "sib"];
const LINKS = [
  { a: "mom", b: "dad" },
  { a: "mom", b: "sib" },
  { a: "sib", b: "friend" },
  { a: "friend", b: "love" },
];

const PHONE: SeatStage = {
  w: 390,
  h: 844,
  top: 300,
  bottom: 740,
  side: 10,
  me: { x: 195, y: 500, r: 58 },
  keepOut: 24,
  pill: { w: 190, h: 36, dy: 40 },
};
const DESKTOP: SeatStage = {
  w: 1440,
  h: 900,
  top: 340,
  bottom: 800,
  side: 40,
  me: { x: 720, y: 560, r: 88 },
  keepOut: 36,
  pill: { w: 200, h: 36, dy: 70 },
};

const ORDER = orderByLinks(PEOPLE, LINKS);
const PAIRS = LINKS.map((l) => [l.a, l.b] as const);
const items = (sizes: number[]) => ORDER.map((id, i) => ({ id, r: sizes[i] }));

type B = { x: number; y: number; r: number };
const personBox = (p: B) => {
  const half = Math.max(p.r, SEAT_LABEL.w / 2);
  return { l: p.x - half, r: p.x + half, t: p.y - p.r, b: p.y + p.r + SEAT_LABEL.h };
};
const apart = (a: ReturnType<typeof personBox>, b: ReturnType<typeof personBox>) =>
  a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t;

describe("orderByLinks", () => {
  it("walks a chain from one end so linked people are neighbours", () => {
    const order = orderByLinks(PEOPLE, LINKS);
    expect(order).toEqual(["dad", "mom", "sib", "friend", "love"]);
    for (const { a, b } of LINKS) expect(Math.abs(order.indexOf(a) - order.indexOf(b))).toBe(1);
  });

  it("keeps the given order without links and ignores unknown ids", () => {
    expect(orderByLinks(PEOPLE, [])).toEqual(PEOPLE);
    expect(orderByLinks(["a", "b"], [{ a: "a", b: "zzz" }])).toEqual(["a", "b"]);
  });

  it("puts every id in exactly once, cycles included", () => {
    const order = orderByLinks(["a", "b", "c"], [
      { a: "a", b: "b" },
      { a: "b", b: "c" },
      { a: "c", b: "a" },
    ]);
    expect([...order].sort()).toEqual(["a", "b", "c"]);
  });
});

describe("ringSeats", () => {
  for (const [name, stage, sizes] of [
    ["phone", PHONE, [42, 38, 36, 34, 32]],
    ["desktop", DESKTOP, [60, 56, 52, 48, 44]],
  ] as const) {
    it(`always fits the band, clears "Та" and nothing overlaps (${name})`, () => {
      for (let seed = 1; seed <= 300; seed++) {
        const its = items([...sizes]);
        const seats = ringSeats(its, stage, PAIRS, seeded(seed));
        expect(seats, `seed ${seed}`).not.toBeNull();
        const bodies = new Map(its.map((it) => [it.id, { ...seats![it.id], r: it.r }]));
        const list = [...bodies.values()];
        for (const b of list) expect(seatFits(b, stage), `seed ${seed}`).toBe(true);
        for (let i = 0; i < list.length; i++)
          for (let j = i + 1; j < list.length; j++)
            expect(apart(personBox(list[i]), personBox(list[j])), `seed ${seed}: ${i}/${j}`).toBe(true);
        const chipBox = (a: string, b: string) => {
          const c = chipCentre(bodies.get(a)!, bodies.get(b)!);
          return { l: c.x - CHIP.w / 2, r: c.x + CHIP.w / 2, t: c.y - CHIP.h / 2, b: c.y + CHIP.h / 2 };
        };
        const chips = PAIRS.map(([a, b]) => chipBox(a, b));
        for (let i = 0; i < chips.length; i++)
          for (let j = i + 1; j < chips.length; j++) expect(apart(chips[i], chips[j]), `seed ${seed}: chips`).toBe(true);
        for (const [a, b] of PAIRS) {
          const chip = chipBox(a, b);
          for (const [id, p] of bodies) {
            // Its own two people: only their captions are off limits.
            const box =
              id === a || id === b
                ? { l: p.x - SEAT_LABEL.w / 2, r: p.x + SEAT_LABEL.w / 2, t: p.y + p.r, b: p.y + p.r + SEAT_LABEL.h }
                : personBox(p);
            expect(apart(chip, box), `seed ${seed}: chip ${a}-${b}/${id}`).toBe(true);
          }
        }
      }
    });
  }

  it("is different on each visit (different random draws)", () => {
    const its = items([42, 38, 36, 34, 32]);
    const a = ringSeats(its, PHONE, PAIRS, seeded(1));
    const b = ringSeats(its, PHONE, PAIRS, seeded(2));
    expect(a).not.toEqual(b);
    expect(ringSeats(its, PHONE, PAIRS, seeded(1))).toEqual(a);
  });

  it("gives up (null) when the band has no room, and handles nobody", () => {
    const tiny: SeatStage = { ...PHONE, top: 440, bottom: 580 };
    expect(ringSeats(items([42, 38, 36, 34, 32]), tiny, PAIRS, seeded(1))).toBeNull();
    expect(ringSeats([], PHONE)).toEqual({});
  });
});
