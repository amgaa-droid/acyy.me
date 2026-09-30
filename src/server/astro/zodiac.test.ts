import { describe, expect, it } from "vitest";

import { ZODIAC_SIGNS } from "@/server/db/seed-data";
import { buildPlaceholderPeriods } from "./calendar";
import { getPeriod, getSign, inRange } from "./zodiac";

const signOf = (date: string) => getSign(date, ZODIAC_SIGNS).code;
const periods = buildPlaceholderPeriods();

describe("inRange", () => {
  it("handles normal and year-wrapping ranges", () => {
    expect(inRange("03-21", { startMd: "03-21", endMd: "04-19" })).toBe(true);
    expect(inRange("04-20", { startMd: "03-21", endMd: "04-19" })).toBe(false);
    expect(inRange("12-31", { startMd: "12-22", endMd: "01-19" })).toBe(true);
    expect(inRange("01-01", { startMd: "12-22", endMd: "01-19" })).toBe(true);
    expect(inRange("01-20", { startMd: "12-22", endMd: "01-19" })).toBe(false);
  });
});

describe("getSign", () => {
  it.each(ZODIAC_SIGNS.map((s) => [s.code, s.startMd, s.endMd]))(
    "%s: first and last day (%s – %s)",
    (code, start, end) => {
      expect(signOf(`2001-${start}`)).toBe(code);
      expect(signOf(`2001-${end}`)).toBe(code);
    },
  );

  it("handles the year boundary and leap day", () => {
    expect(signOf("1999-12-31")).toBe("capricorn");
    expect(signOf("2000-01-01")).toBe("capricorn");
    expect(signOf("2000-01-19")).toBe("capricorn");
    expect(signOf("2000-01-20")).toBe("aquarius");
    expect(signOf("2000-02-29")).toBe("pisces");
  });

  it("falls back to 02-28 when no range covers 02-29", () => {
    const ranges = [
      { code: "a", startMd: "01-01", endMd: "02-28" },
      { code: "b", startMd: "03-01", endMd: "12-31" },
    ];
    expect(getSign("2024-02-29", ranges).code).toBe("a");
  });

  it("throws when nothing covers the date", () => {
    expect(() => getSign("2001-06-01", [{ code: "a", startMd: "01-01", endMd: "01-31" }])).toThrow(
      /06-01/,
    );
  });
});

describe("getPeriod", () => {
  it("period 1 spans the year boundary 12-26 – 01-02", () => {
    expect(getPeriod("1990-12-25", periods).no).toBe(48);
    expect(getPeriod("1990-12-26", periods).no).toBe(1);
    expect(getPeriod("1991-01-02", periods).no).toBe(1);
    expect(getPeriod("1991-01-03", periods).no).toBe(2);
  });

  it("covers 02-29 and 12-31", () => {
    expect(getPeriod("2000-02-29", periods).no).toBeGreaterThan(0);
    expect(getPeriod("2000-12-31", periods).no).toBe(1);
  });
});
