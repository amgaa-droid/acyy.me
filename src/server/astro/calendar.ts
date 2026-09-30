/** Month-day ("MM-DD") helpers. The astro calendar always has 366 days (02-29 included). */

export type MonthDay = string;

const DAYS_IN_MONTH_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** All 366 month-days in calendar order, 01-01 … 12-31. */
export const ALL_MONTH_DAYS: readonly MonthDay[] = DAYS_IN_MONTH_LEAP.flatMap((days, m) =>
  Array.from({ length: days }, (_, d) => `${pad2(m + 1)}-${pad2(d + 1)}`),
);

const MONTH_DAY_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isMonthDay(value: string): value is MonthDay {
  if (!MONTH_DAY_RE.test(value)) return false;
  const [m, d] = value.split("-").map(Number);
  return d <= DAYS_IN_MONTH_LEAP[m - 1];
}

/** Month-days from `start` walking forward `count` days, wrapping 12-31 → 01-01. */
export function monthDaysFrom(start: MonthDay, count: number): MonthDay[] {
  const i = ALL_MONTH_DAYS.indexOf(start);
  if (i < 0) throw new Error(`Invalid month-day: ${start}`);
  return Array.from({ length: count }, (_, k) => ALL_MONTH_DAYS[(i + k) % ALL_MONTH_DAYS.length]);
}

export type MonthDayRange = { startMd: MonthDay; endMd: MonthDay };

/**
 * Placeholder 48 periods (SPEC §2.4) until the real table is imported:
 * period 1 starts on 12-26, the 366-day year is split into 48 near-equal (7–8 day) chunks.
 */
export function buildPlaceholderPeriods(): ({ no: number } & MonthDayRange)[] {
  const days = monthDaysFrom("12-26", ALL_MONTH_DAYS.length);
  const total = days.length;
  return Array.from({ length: 48 }, (_, i) => {
    const from = Math.ceil((i * total) / 48);
    const to = Math.ceil(((i + 1) * total) / 48) - 1;
    return { no: i + 1, startMd: days[from], endMd: days[to] };
  });
}
