import { describe, expect, it } from "vitest";

import {
  ageOn,
  clampBirthDate,
  daysInMonth,
  formatBirthDate,
  formatDate,
  formatDateTime,
  formatMonthDay,
  formatTime,
  isLeapYear,
  parseIsoDate,
  todayYmd,
  toIsoDate,
  validateBirthDate,
} from "./birth-date";

const today = { y: 2026, m: 9, d: 30 };

describe("calendar basics", () => {
  it("knows leap years", () => {
    expect([2000, 2024, 1996].map(isLeapYear)).toEqual([true, true, true]);
    expect([1900, 2023, 2100].map(isLeapYear)).toEqual([false, false, false]);
  });

  it("days in February", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2023, 12)).toBe(31);
  });

  it("round-trips ISO dates", () => {
    expect(toIsoDate({ y: 1990, m: 3, d: 5 })).toBe("1990-03-05");
    expect(parseIsoDate("1990-03-05")).toEqual({ y: 1990, m: 3, d: 5 });
    expect(parseIsoDate("2023-02-29")).toBeNull();
    expect(parseIsoDate("2024-02-29")).toEqual({ y: 2024, m: 2, d: 29 });
    expect(parseIsoDate("1990-3-5")).toBeNull();
  });
});

describe("validateBirthDate", () => {
  it("accepts valid past dates including 02-29 on leap years", () => {
    expect(validateBirthDate("2000-02-29", today)).toBeNull();
    expect(validateBirthDate("1900-01-01", today)).toBeNull();
    expect(validateBirthDate("2026-09-30", today)).toBeNull();
  });

  it("rejects future, pre-1900 and impossible dates", () => {
    expect(validateBirthDate("2026-10-01", today)).toBe("future");
    expect(validateBirthDate("1899-12-31", today)).toBe("too_old");
    expect(validateBirthDate("2001-02-29", today)).toBe("invalid");
    expect(validateBirthDate("", today)).toBe("invalid");
  });
});

describe("clampBirthDate", () => {
  it("clamps the day when the month shrinks", () => {
    expect(clampBirthDate({ y: 2023, m: 2, d: 31 }, today)).toEqual({ y: 2023, m: 2, d: 28 });
    expect(clampBirthDate({ y: 2024, m: 2, d: 31 }, today)).toEqual({ y: 2024, m: 2, d: 29 });
  });

  it("never goes past today or before 1900", () => {
    expect(clampBirthDate({ y: 2026, m: 12, d: 31 }, today)).toEqual({ y: 2026, m: 9, d: 30 });
    expect(clampBirthDate({ y: 1850, m: 1, d: 1 }, today)).toEqual({ y: 1900, m: 1, d: 1 });
  });
});

describe("ageOn", () => {
  it("counts full years", () => {
    expect(ageOn({ y: 2008, m: 10, d: 1 }, today)).toBe(17);
    expect(ageOn({ y: 2008, m: 9, d: 30 }, today)).toBe(18);
  });

  it("treats a 02-29 birthday as passed on 03-01 in non-leap years", () => {
    expect(ageOn({ y: 2008, m: 2, d: 29 }, { y: 2026, m: 2, d: 28 })).toBe(17);
    expect(ageOn({ y: 2008, m: 2, d: 29 }, { y: 2026, m: 3, d: 1 })).toBe(18);
  });
});

describe("todayYmd", () => {
  it("uses Ulaanbaatar time (UTC+8)", () => {
    // 2026-09-30 17:00 UTC is already 2026-10-01 01:00 in Ulaanbaatar.
    expect(todayYmd(new Date("2026-09-30T17:00:00Z"))).toEqual({ y: 2026, m: 10, d: 1 });
  });
});

describe("date formats", () => {
  it("writes every date dotted: a birth date, a month-day", () => {
    expect(formatBirthDate("1985-04-02")).toBe("1985.04.02");
    expect(formatMonthDay("05-21")).toBe("05.21");
  });

  it("writes a moment as the date (and time) in Ulaanbaatar", () => {
    // 17:05 UTC is 01:05 the next day in Ulaanbaatar (UTC+8): the year turns over too.
    const at = new Date("2026-12-31T17:05:00Z");
    expect(formatDate(at)).toBe("2027.01.01");
    expect(formatDateTime(at)).toBe("2027.01.01 01:05");
    expect(formatTime(at)).toBe("01:05");
    // Midnight is 00, not 24.
    expect(formatDateTime(new Date("2026-10-02T16:00:00Z"))).toBe("2026.10.03 00:00");
  });
});
