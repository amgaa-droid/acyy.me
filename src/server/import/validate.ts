import { parseBody } from "@/lib/body";
import type { KeyGender, KeyType } from "@/lib/domain";
import { isMonthDay, type MonthDay } from "@/server/astro/calendar";
import { validateCoverage } from "@/server/astro/coverage";
import {
  expectedPartKeys,
  genderKey,
  orderedPairKey,
  periodPairKey,
  signPairKey,
} from "@/server/content/keys";
import type { FieldRow } from "@/server/products";
import { PERIODS_KIND, type ImportKindSpec, type ImportTarget } from "./kinds";
import type { ParsedRow } from "./parse";

type ImportErrorCode =
  | "missing_column"
  | "required"
  | "invalid_month_day"
  | "unknown_sign"
  | "invalid_period"
  | "invalid_gender"
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

type ContentEntryInput = {
  key: string;
  title: string;
  fields: Record<string, string>;
  teaser: string | null;
  score: number | null;
};
type RangeInput = { no: number; startMd: MonthDay; endMd: MonthDay; label: string | null };

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

type ImportRefs = {
  signs: { code: string; nameMn: string }[];
  periodCount: number;
};

export const MAX_TITLE = 200;
/** Per sub-section. */
export const MAX_FIELD = 20_000;
export const MAX_TEASER = 500;

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
  if (spec.kind === PERIODS_KIND) return finishRanges(report, rows, refs);

  const target = spec.target!;
  const seen = new Map<string, number>();
  for (const { row, values } of rows) {
    const errs: ImportError[] = [];
    let key = resolveKey(target.keyType, values, refs, row, errs);
    if (key && target.byGender) {
      const gender = resolveGender(values.gender ?? "");
      if (!gender) {
        errs.push({ code: "invalid_gender", row, column: "gender", value: values.gender });
        key = null;
      } else key = genderKey(key, gender);
    }

    const title = (values.title ?? "").trim();
    if (!title) errs.push({ code: "required", row, column: "title" });
    else if (title.length > MAX_TITLE) errs.push({ code: "too_long", row, column: "title" });

    const fields = rowFields(target, values);
    for (const f of target.fields) {
      const v = fields[f.code];
      if (!v && f.required) errs.push({ code: "required", row, column: f.code });
      else if (v && v.length > MAX_FIELD) errs.push({ code: "too_long", row, column: f.code });
    }
    if (Object.keys(fields).length === 0 && !target.fields.some((f) => f.required)) {
      errs.push({ code: "required", row, column: target.fields[0]?.code ?? "body" });
    }

    const teaser = (values.teaser ?? "").trim() || null;
    if (teaser && teaser.length > MAX_TEASER)
      errs.push({ code: "too_long", row, column: "teaser" });

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
    else if (key) report.entries.push({ key, title, fields, teaser, score });
  }

  const expected = expectedPartKeys(target, {
    signCodes: refs.signs.map((s) => s.code),
    periodCount: refs.periodCount,
  });
  report.missing = expected.filter((k) => !seen.has(k));
  report.toUpdate = report.entries.filter((e) => existingKeys.has(e.key)).length;
  report.toInsert = report.entries.length - report.toUpdate;
  report.ok = report.errors.length === 0;
  return report;
}

function resolveKey(
  keyType: KeyType,
  values: Record<string, string>,
  refs: ImportRefs,
  row: number,
  errs: ImportError[],
): string | null {
  const sign = (column: string) => {
    const code = resolveSign(values[column] ?? "", refs.signs);
    if (!code) errs.push({ code: "unknown_sign", row, column, value: values[column] });
    return code;
  };
  const period = (column: string) => {
    const n = resolvePeriod(values[column] ?? "", refs.periodCount);
    if (!n) errs.push({ code: "invalid_period", row, column, value: values[column] });
    return n;
  };
  switch (keyType) {
    case "month_day": {
      const md = normalizeMonthDay(values.month_day ?? "");
      if (!md)
        errs.push({ code: "invalid_month_day", row, column: "month_day", value: values.month_day });
      return md;
    }
    case "sign":
      return sign("sign");
    case "period": {
      const n = period("period");
      return n ? String(n) : null;
    }
    case "sign_pair":
    case "sign_pair_ordered": {
      const a = sign("sign_a");
      const b = sign("sign_b");
      if (!a || !b) return null;
      return keyType === "sign_pair" ? signPairKey(a, b) : orderedPairKey(a, b);
    }
    case "period_pair": {
      const a = period("period_a");
      const b = period("period_b");
      return a && b ? periodPairKey(a, b) : null;
    }
  }
}

const GENDER_WORDS: Record<string, KeyGender> = {
  male: "male",
  m: "male",
  эр: "male",
  эрэгтэй: "male",
  female: "female",
  f: "female",
  эм: "female",
  эмэгтэй: "female",
};

export function resolveGender(raw: string): KeyGender | null {
  return GENDER_WORDS[raw.trim().toLowerCase()] ?? null;
}

/** Sub-section values of a row: explicit columns, else split out of a legacy `body`. */
function rowFields(target: ImportTarget, values: Record<string, string>): Record<string, string> {
  const fromBody = values.body?.trim() ? splitBodyToFields(values.body, target.fields) : {};
  const out: Record<string, string> = {};
  for (const f of target.fields) {
    const v = (values[f.code] ?? "").replace(/\r\n?/g, "\n").trim() || fromBody[f.code];
    if (v) out[f.code] = v;
  }
  return out;
}

/**
 * "## Heading" sections of a single text → sub-sections by (case-insensitive) name. Text before
 * the first heading and unmatched sections (heading kept) go to "general", or the first prose field.
 */
export function splitBodyToFields(
  body: string,
  fields: readonly Pick<FieldRow, "code" | "nameMn" | "kind">[],
): Record<string, string> {
  const byName = new Map(fields.map((f) => [f.nameMn.toLocaleLowerCase("mn"), f.code]));
  const fallback =
    fields.find((f) => f.code === "general")?.code ??
    fields.find((f) => f.kind === "text")?.code ??
    fields[0]?.code;
  const parts: Record<string, string[]> = {};
  const push = (code: string | undefined, text: string) => {
    if (code) (parts[code] ??= []).push(text);
  };
  let current = fallback;
  for (const block of parseBody(body)) {
    if (block.type === "heading") {
      const code = byName.get(block.text.toLocaleLowerCase("mn"));
      current = code ?? fallback;
      if (!code) push(fallback, `## ${block.text}`);
    } else {
      push(current, block.text);
    }
  }
  const out: Record<string, string> = {};
  for (const [code, blocks] of Object.entries(parts)) {
    const text = blocks.join("\n\n").trim();
    // A lone "## heading" with nothing under it isn't content.
    if (text && !/^## [^\n]*$/.test(text)) out[code] = text;
  }
  return out;
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
