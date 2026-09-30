import { isMonthDay, type MonthDay } from "@/server/astro/calendar";
import { validateCoverage } from "@/server/astro/coverage";
import { expectedKeys, periodPairKey, signPairKey } from "@/server/content/keys";
import type { ImportKindSpec } from "./kinds";
import type { ParsedRow } from "./parse";

export type ImportErrorCode =
  | "missing_column"
  | "required"
  | "invalid_month_day"
  | "unknown_sign"
  | "invalid_period"
  | "duplicate"
  | "invalid_score"
  | "too_long"
  | "invalid_range"
  | "missing_period"
  | "coverage_gap"
  | "coverage_overlap"
  | "empty_file";

export type ImportError = {
  code: ImportErrorCode;
  /** Excel row number (1 = header); absent for file-level errors. */
  row?: number;
  column?: string;
  value?: string;
  /** e.g. the first row of a duplicate, or gap days */
  detail?: string;
};

export type ContentEntryInput = { key: string; title: string; body: string; score: number | null };
export type RangeInput = { no: number; startMd: MonthDay; endMd: MonthDay; label: string | null };

export type ImportReport = {
  kind: ImportKindSpec["kind"];
  rows: number;
  errors: ImportError[];
  /** Valid content entries (empty for periods48). */
  entries: ContentEntryInput[];
  /** Valid ranges (periods48 only). */
  ranges: RangeInput[];
  /** Expected keys that the file doesn't contain (not an error: partial imports are allowed). */
  missing: string[];
  toInsert: number;
  toUpdate: number;
  ok: boolean;
};

export type ImportRefs = {
  signs: { code: string; nameMn: string }[];
  periodCount: number;
};

export const MAX_TITLE = 200;
export const MAX_BODY = 20_000;

/** Accepts MM-DD, M-D, MM/DD, MM.DD. */
export function normalizeMonthDay(raw: string): MonthDay | null {
  const m = /^(\d{1,2})[-/.](\d{1,2})$/.exec(raw.trim());
  if (!m) return null;
  const md = `${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return isMonthDay(md) ? md : null;
}

/** Sign by code or Mongolian name, case-insensitive. */
export function resolveSign(raw: string, signs: ImportRefs["signs"]): string | null {
  const v = raw.trim().toLowerCase();
  const hit = signs.find((s) => s.code.toLowerCase() === v || s.nameMn.toLowerCase() === v);
  return hit?.code ?? null;
}

function resolvePeriod(raw: string, count: number): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw);
  return n >= 1 && n <= count ? n : null;
}

export function validateImport(
  spec: ImportKindSpec,
  rows: ParsedRow[],
  refs: ImportRefs,
  existingKeys: ReadonlySet<string> = new Set(),
): ImportReport {
  const report: ImportReport = {
    kind: spec.kind,
    rows: rows.length,
    errors: [],
    entries: [],
    ranges: [],
    missing: [],
    toInsert: 0,
    toUpdate: 0,
    ok: false,
  };
  if (rows.length === 0) {
    report.errors.push({ code: "empty_file" });
    return report;
  }
  if (spec.kind === "periods48") return finishRanges(report, rows, refs);

  const seen = new Map<string, number>();
  for (const { row, values } of rows) {
    const errs: ImportError[] = [];
    let key: string | null = null;

    switch (spec.kind) {
      case "birthday": {
        key = normalizeMonthDay(values.month_day ?? "");
        if (!key)
          errs.push({
            code: "invalid_month_day",
            row,
            column: "month_day",
            value: values.month_day,
          });
        break;
      }
      case "synastry_signs": {
        const a = resolveSign(values.sign_a ?? "", refs.signs);
        const b = resolveSign(values.sign_b ?? "", refs.signs);
        if (!a) errs.push({ code: "unknown_sign", row, column: "sign_a", value: values.sign_a });
        if (!b) errs.push({ code: "unknown_sign", row, column: "sign_b", value: values.sign_b });
        if (a && b) key = signPairKey(a, b);
        break;
      }
      case "synastry_periods": {
        const a = resolvePeriod(values.period_a ?? "", refs.periodCount);
        const b = resolvePeriod(values.period_b ?? "", refs.periodCount);
        if (!a)
          errs.push({ code: "invalid_period", row, column: "period_a", value: values.period_a });
        if (!b)
          errs.push({ code: "invalid_period", row, column: "period_b", value: values.period_b });
        if (a && b) key = periodPairKey(a, b);
        break;
      }
      default: {
        key = resolveSign(values.sign ?? "", refs.signs);
        if (!key) errs.push({ code: "unknown_sign", row, column: "sign", value: values.sign });
      }
    }

    const title = (values.title ?? "").trim();
    const body = (values.body ?? "").trim();
    if (!title) errs.push({ code: "required", row, column: "title" });
    else if (title.length > MAX_TITLE) errs.push({ code: "too_long", row, column: "title" });
    if (!body) errs.push({ code: "required", row, column: "body" });
    else if (body.length > MAX_BODY) errs.push({ code: "too_long", row, column: "body" });

    let score: number | null = null;
    const rawScore = (values.score ?? "").trim().replace(/%$/, "");
    if (rawScore) {
      const n = Number(rawScore);
      if (Number.isInteger(n) && n >= 0 && n <= 100) score = n;
      else errs.push({ code: "invalid_score", row, column: "score", value: values.score });
    }

    if (key) {
      const first = seen.get(key);
      if (first !== undefined) {
        errs.push({ code: "duplicate", row, value: key, detail: String(first) });
      } else {
        seen.set(key, row);
      }
    }

    if (errs.length) report.errors.push(...errs);
    else if (key) report.entries.push({ key, title, body, score });
  }

  const target = spec.target!;
  const expected =
    expectedKeys(target.product, {
      signCodes: refs.signs.map((s) => s.code),
      periodCount: refs.periodCount,
    }).find((s) => s.section === target.section)?.keys ?? [];
  report.missing = expected.filter((k) => !seen.has(k));
  report.toUpdate = report.entries.filter((e) => existingKeys.has(e.key)).length;
  report.toInsert = report.entries.length - report.toUpdate;
  report.ok = report.errors.length === 0;
  return report;
}

function finishRanges(report: ImportReport, rows: ParsedRow[], refs: ImportRefs): ImportReport {
  const seen = new Map<number, number>();
  for (const { row, values } of rows) {
    const errs: ImportError[] = [];
    const no = resolvePeriod(values.no ?? "", refs.periodCount);
    const startMd = normalizeMonthDay(values.start ?? "");
    const endMd = normalizeMonthDay(values.end ?? "");
    if (!no) errs.push({ code: "invalid_period", row, column: "no", value: values.no });
    if (!startMd)
      errs.push({ code: "invalid_month_day", row, column: "start", value: values.start });
    if (!endMd) errs.push({ code: "invalid_month_day", row, column: "end", value: values.end });
    if (no) {
      const first = seen.get(no);
      if (first !== undefined)
        errs.push({ code: "duplicate", row, value: String(no), detail: String(first) });
      else seen.set(no, row);
    }
    if (errs.length) report.errors.push(...errs);
    else
      report.ranges.push({
        no: no!,
        startMd: startMd!,
        endMd: endMd!,
        label: values.label?.trim() || null,
      });
  }

  for (let n = 1; n <= refs.periodCount; n++) {
    if (!seen.has(n)) report.errors.push({ code: "missing_period", value: String(n) });
  }

  if (report.errors.length === 0) {
    const sorted = [...report.ranges].sort((a, b) => a.no - b.no);
    for (const issue of validateCoverage(sorted).issues) {
      if (issue.kind === "gap") {
        report.errors.push({ code: "coverage_gap", detail: summarizeDays(issue.days) });
      } else if (issue.kind === "overlap") {
        report.errors.push({
          code: "coverage_overlap",
          value: issue.day,
          detail: issue.ranges.map((i) => sorted[i].no).join(", "),
        });
      } else {
        report.errors.push({ code: "invalid_range", value: issue.value });
      }
    }
  }

  report.toUpdate = report.ranges.length;
  report.ok = report.errors.length === 0;
  return report;
}

/** "01-05, 01-06, … (12)" — keeps reports short. */
function summarizeDays(days: string[]): string {
  const head = days.slice(0, 6).join(", ");
  return days.length > 6 ? `${head}, … (${days.length})` : head;
}
