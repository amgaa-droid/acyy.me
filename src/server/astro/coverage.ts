import { ALL_MONTH_DAYS, isMonthDay, type MonthDay, type MonthDayRange } from "./calendar";
import { inRange } from "./zodiac";

export type CoverageIssue =
  | { kind: "invalid"; index: number; value: string }
  | { kind: "gap"; days: MonthDay[] }
  | { kind: "overlap"; day: MonthDay; ranges: number[] };

/**
 * Checks that every one of the 366 month-days (02-29 included) falls in exactly one range
 * (SPEC §2.4). Used by admin range editing and the periods48 import; save only when ok.
 * 02-29 counts as covered if 02-28 is, matching the lookup fallback in zodiac.ts.
 * Issues report range indexes (0-based) so callers can map them to rows.
 */
export function validateCoverage(ranges: readonly MonthDayRange[]): {
  ok: boolean;
  issues: CoverageIssue[];
} {
  const issues: CoverageIssue[] = [];

  ranges.forEach((r, index) => {
    for (const value of [r.startMd, r.endMd]) {
      if (!isMonthDay(value)) issues.push({ kind: "invalid", index, value });
    }
  });
  if (issues.length) return { ok: false, issues };

  const hits = (md: MonthDay) => ranges.flatMap((r, i) => (inRange(md, r) ? [i] : []));

  const gaps: MonthDay[] = [];
  for (const md of ALL_MONTH_DAYS) {
    let found = hits(md);
    if (found.length === 0 && md === "02-29") found = hits("02-28");
    if (found.length === 0) gaps.push(md);
    else if (found.length > 1) issues.push({ kind: "overlap", day: md, ranges: found });
  }
  if (gaps.length) issues.unshift({ kind: "gap", days: gaps });

  return { ok: issues.length === 0, issues };
}
