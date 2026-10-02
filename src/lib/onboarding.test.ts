import { describe, expect, it } from "vitest";

import { guideState, onboardingMarkSchema } from "@/lib/onboarding";

describe("guideState", () => {
  it("welcomes a brand-new user and starts with their own reading", () => {
    expect(guideState({}, { people: 0, pairs: 0 })).toEqual({
      active: true,
      welcome: true,
      current: "self",
      done: { self: false, add: false, link: false },
      count: 0,
    });
  });

  it("goes self → add → link, counting what's done", () => {
    const at = "2026-10-02T00:00:00Z";
    expect(guideState({ welcome: at, self: at }, { people: 0, pairs: 0 })).toMatchObject({
      welcome: false,
      current: "add",
      count: 1,
    });
    expect(guideState({ welcome: at, self: at }, { people: 1, pairs: 0 })).toMatchObject({
      current: "link",
      count: 2,
    });
  });

  it("counts steps done another way and points at the first one left", () => {
    // Added someone and bought a pair, never opened their own reading.
    expect(guideState({}, { people: 2, pairs: 1 })).toMatchObject({ current: "self", count: 2 });
  });

  it("switches off when finished or dismissed", () => {
    const at = "2026-10-02T00:00:00Z";
    expect(guideState({ self: at, link: at }, { people: 1, pairs: 0 }).active).toBe(false);
    expect(guideState({ dismissed: at }, { people: 0, pairs: 0 })).toMatchObject({
      active: false,
      welcome: false,
    });
  });

  it("accepts only known marks", () => {
    expect(onboardingMarkSchema.safeParse("link").success).toBe(true);
    expect(onboardingMarkSchema.safeParse("admin").success).toBe(false);
  });
});
