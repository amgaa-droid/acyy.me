import { describe, expect, it } from "vitest";

import { ZODIAC_SIGNS } from "@/server/db/seed-data";
import { buildPlaceholderPeriods } from "./calendar";
import { validateCoverage } from "./coverage";

describe("validateCoverage", () => {
  it("accepts the seeded signs and placeholder periods", () => {
    expect(validateCoverage(ZODIAC_SIGNS)).toEqual({ ok: true, issues: [] });
    expect(validateCoverage(buildPlaceholderPeriods()).ok).toBe(true);
  });

  it("accepts two ranges that split the year, including a wrap", () => {
    expect(
      validateCoverage([
        { startMd: "12-01", endMd: "05-31" },
        { startMd: "06-01", endMd: "11-30" },
      ]).ok,
    ).toBe(true);
  });

  it("treats 02-29 as covered through 02-28", () => {
    expect(
      validateCoverage([
        { startMd: "01-01", endMd: "02-28" },
        { startMd: "03-01", endMd: "12-31" },
      ]).ok,
    ).toBe(true);
  });

  it("reports gaps", () => {
    const signs = ZODIAC_SIGNS.map((s) => (s.code === "leo" ? { ...s, endMd: "08-20" } : s));
    const { ok, issues } = validateCoverage(signs);
    expect(ok).toBe(false);
    expect(issues).toContainEqual({ kind: "gap", days: ["08-21", "08-22"] });
  });

  it("reports overlaps with both range indexes", () => {
    const signs = ZODIAC_SIGNS.map((s) => (s.code === "aries" ? { ...s, endMd: "04-21" } : s));
    const { issues } = validateCoverage(signs);
    expect(issues).toContainEqual({ kind: "overlap", day: "04-20", ranges: [0, 1] });
    expect(issues).toContainEqual({ kind: "overlap", day: "04-21", ranges: [0, 1] });
  });

  it("reports invalid month-days without evaluating coverage", () => {
    const { ok, issues } = validateCoverage([{ startMd: "02-30", endMd: "13-01" }]);
    expect(ok).toBe(false);
    expect(issues).toEqual([
      { kind: "invalid", index: 0, value: "02-30" },
      { kind: "invalid", index: 0, value: "13-01" },
    ]);
  });

  it("an empty table is one big gap", () => {
    const { issues } = validateCoverage([]);
    expect(issues[0]).toMatchObject({ kind: "gap" });
    expect((issues[0] as { days: string[] }).days).toHaveLength(366);
  });
});
