import { describe, expect, it } from "vitest";

import { ZODIAC_SIGNS } from "@/server/db/seed-data";
import { CONSTELLATIONS } from "./constellations";

describe("CONSTELLATIONS", () => {
  it("has artwork for every seeded sign", () => {
    for (const { code } of ZODIAC_SIGNS) expect(CONSTELLATIONS[code], code).toBeDefined();
  });

  it("only references existing stars and stays inside the viewBox", () => {
    for (const [code, art] of Object.entries(CONSTELLATIONS)) {
      const n = art.stars.length;
      expect(art.bright, code).toBeLessThan(n);
      for (const [a, b] of art.lines) {
        expect(a, code).toBeLessThan(n);
        expect(b, code).toBeLessThan(n);
      }
      for (const [x, y] of art.stars) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(100);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(100);
      }
    }
  });
});
