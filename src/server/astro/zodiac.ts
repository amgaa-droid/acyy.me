import type { MonthDay, MonthDayRange } from "./calendar";

/**
 * Sign / period lookup by month-day (SPEC §2.4). Ranges come from the DB
 * (`zodiac_signs`, `periods48`); nothing about the ranges is hard-coded here.
 * A range with end < start wraps the year (e.g. 12-22 – 01-19).
 * 02-29 falls back to 02-28 when no range names it explicitly.
 */

export function inRange(md: MonthDay, { startMd, endMd }: MonthDayRange): boolean {
  return startMd <= endMd ? md >= startMd && md <= endMd : md >= startMd || md <= endMd;
}

export function findRange<T extends MonthDayRange>(
  md: MonthDay,
  ranges: readonly T[],
): T | undefined {
  return (
    ranges.find((r) => inRange(md, r)) ?? (md === "02-29" ? findRange("02-28", ranges) : undefined)
  );
}

/** "YYYY-MM-DD" → "MM-DD" */
export function monthDayOf(isoDate: string): MonthDay {
  return isoDate.slice(5, 10);
}

export class RangeNotFoundError extends Error {
  constructor(what: string, md: MonthDay) {
    super(`No ${what} covers ${md}`);
  }
}

export function getSign<T extends MonthDayRange & { code: string }>(
  isoDate: string,
  signs: readonly T[],
): T {
  const md = monthDayOf(isoDate);
  const sign = findRange(md, signs);
  if (!sign) throw new RangeNotFoundError("zodiac sign", md);
  return sign;
}

export function getPeriod<T extends MonthDayRange & { no: number }>(
  isoDate: string,
  periods: readonly T[],
): T {
  const md = monthDayOf(isoDate);
  const period = findRange(md, periods);
  if (!period) throw new RangeNotFoundError("period", md);
  return period;
}
