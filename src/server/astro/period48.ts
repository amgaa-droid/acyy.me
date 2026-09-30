import type { MonthDayRange } from "./calendar";
import { RangeNotFoundError, findRange, monthDayOf } from "./zodiac";

/** 48-period lookup (SPEC §2.4); same range rules as signs, periods come from `periods48`. */
export function getPeriod<T extends MonthDayRange & { no: number }>(
  isoDate: string,
  periods: readonly T[],
): T {
  const md = monthDayOf(isoDate);
  const period = findRange(md, periods);
  if (!period) throw new RangeNotFoundError("period", md);
  return period;
}
