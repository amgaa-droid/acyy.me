import { describe, expect, it } from "vitest";

import { addDays, dayLabel, initialHomeView, shortDayLabel, todayIso, weekdayOf } from "./daily";

describe("daily dates", () => {
  it("adds days across months, years and leap days", () => {
    expect(addDays("2026-10-02", 1)).toBe("2026-10-03");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2026-10-02", 0)).toBe("2026-10-02");
  });

  it("counts weekdays from Monday", () => {
    expect(weekdayOf("2026-10-05")).toBe(0); // Monday
    expect(weekdayOf("2026-10-02")).toBe(4); // Friday
    expect(weekdayOf("2026-10-04")).toBe(6); // Sunday
  });

  it("labels days in Mongolian", () => {
    expect(dayLabel("2026-10-02")).toBe("10-р сарын 2, Баасан");
    expect(dayLabel("2027-01-04")).toBe("1-р сарын 4, Даваа");
    expect(shortDayLabel("2026-10-04")).toBe("10.04 Ня");
  });

  it("takes today in Mongolia time, not the server's", () => {
    // 2026-10-01 17:30 UTC is already 10-02 01:30 in Ulaanbaatar (UTC+8).
    expect(todayIso(new Date("2026-10-01T17:30:00Z"))).toBe("2026-10-02");
    expect(todayIso(new Date("2026-10-01T15:59:00Z"))).toBe("2026-10-01");
  });
});

describe("initialHomeView", () => {
  it("opens the view picked last", () => {
    expect(initialHomeView("planets", false)).toBe("planets");
    expect(initialHomeView("today", true)).toBe("today");
  });

  it("defaults to today, or the planets while the first-run guide is on", () => {
    expect(initialHomeView(undefined, false)).toBe("today");
    expect(initialHomeView(undefined, true)).toBe("planets");
    expect(initialHomeView("bogus", false)).toBe("today");
  });
});
