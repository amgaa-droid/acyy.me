import { describe, expect, it } from "vitest";

import { ubPeriodStarts } from "./stats";

describe("ubPeriodStarts", () => {
  it("uses Ulaanbaatar midnight, not UTC", () => {
    // 2026-09-30 17:00 UTC = 2026-10-01 01:00 in UB → today starts 2026-09-30T16:00Z.
    const { today, month } = ubPeriodStarts(new Date("2026-09-30T17:00:00Z"));
    expect(today.toISOString()).toBe("2026-09-30T16:00:00.000Z");
    expect(month.toISOString()).toBe("2026-09-30T16:00:00.000Z");
    const mid = ubPeriodStarts(new Date("2026-09-15T03:00:00Z"));
    expect(mid.today.toISOString()).toBe("2026-09-14T16:00:00.000Z");
    expect(mid.month.toISOString()).toBe("2026-08-31T16:00:00.000Z");
  });
});
