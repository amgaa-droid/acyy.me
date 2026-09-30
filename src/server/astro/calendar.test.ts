import { describe, expect, it } from "vitest";

import { ALL_MONTH_DAYS, buildPlaceholderPeriods, isMonthDay, monthDaysFrom } from "./calendar";

describe("ALL_MONTH_DAYS", () => {
  it("has 366 unique days including 02-29", () => {
    expect(ALL_MONTH_DAYS).toHaveLength(366);
    expect(new Set(ALL_MONTH_DAYS).size).toBe(366);
    expect(ALL_MONTH_DAYS).toContain("02-29");
    expect(ALL_MONTH_DAYS[0]).toBe("01-01");
    expect(ALL_MONTH_DAYS.at(-1)).toBe("12-31");
  });
});

describe("isMonthDay", () => {
  it.each(["01-01", "02-29", "12-31", "04-30"])("accepts %s", (v) => {
    expect(isMonthDay(v)).toBe(true);
  });
  it.each(["00-10", "13-01", "02-30", "04-31", "1-01", "01-1", "", "12/31"])("rejects %s", (v) => {
    expect(isMonthDay(v)).toBe(false);
  });
});

describe("monthDaysFrom", () => {
  it("wraps across the year boundary", () => {
    expect(monthDaysFrom("12-30", 4)).toEqual(["12-30", "12-31", "01-01", "01-02"]);
  });
});

describe("buildPlaceholderPeriods", () => {
  const periods = buildPlaceholderPeriods();

  it("creates 48 periods, the first being 12-26 – 01-02", () => {
    expect(periods).toHaveLength(48);
    expect(periods[0]).toEqual({ no: 1, startMd: "12-26", endMd: "01-02" });
    expect(periods.at(-1)?.endMd).toBe("12-25");
  });

  it("covers every one of the 366 days exactly once, contiguously", () => {
    const covered = periods.flatMap((p) => {
      const days: string[] = [];
      for (const d of monthDaysFrom(p.startMd, 366)) {
        days.push(d);
        if (d === p.endMd) break;
      }
      return days;
    });
    expect(covered).toHaveLength(366);
    expect(new Set(covered).size).toBe(366);
    for (const p of periods) {
      const len = monthDaysFrom(p.startMd, 9).indexOf(p.endMd) + 1;
      expect([7, 8]).toContain(len);
    }
  });
});
