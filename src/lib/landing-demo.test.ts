import { describe, expect, it } from "vitest";

import { DEMO_LINKS, DEMO_PEOPLE, compatLevel } from "./landing-demo";

describe("compatLevel", () => {
  it.each([
    [100, "great"],
    [85, "great"],
    [84, "good"],
    [70, "good"],
    [69, "work"],
    [0, "work"],
  ] as const)("%i → %s", (score, level) => {
    expect(compatLevel(score)).toBe(level);
  });
});

describe("demo data", () => {
  it("links only known, distinct people with scores in 0–100", () => {
    const ids = new Set(DEMO_PEOPLE.map((p) => p.id));
    for (const l of DEMO_LINKS) {
      expect(ids.has(l.a) && ids.has(l.b) && l.a !== l.b).toBe(true);
      expect(l.score).toBeGreaterThanOrEqual(0);
      expect(l.score).toBeLessThanOrEqual(100);
    }
  });

  it("has valid birth dates", () => {
    for (const p of DEMO_PEOPLE) expect(p.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
